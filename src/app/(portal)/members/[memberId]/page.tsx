import { sumByMonth } from "@/lib/giving";
import { ContributionsCard } from "@/components/members/contributions-card";
import { summariseContributions } from "@/lib/giving-summary";
import { memberStanding } from "@/lib/handbook/member-standing";
import { getHandbookRules } from "@/lib/handbook/rules-server";
import { canActOn, isLeader, positionLabel } from "@/lib/access";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Phone, Calendar, HandCoins, Clock, CheckCircle2, Video } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberGivingChart } from "@/components/charts/member-giving-chart";
import { InviteMemberButton } from "@/components/members/invite-member-button";
import { MemberAvatar } from "@/components/members/member-avatar";
import { MemberPhotoUpload } from "@/components/members/member-photo-upload";
import { TrainingStatusButton } from "@/components/training/training-status-button";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getChapterCells } from "@/lib/data/cells";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurch,
  getCountry,
  getMember,
  memberFullName,
  formatTenure,
  memberTenureYears,
  memberTotalGiving,
  memberTrainingPoints,
} from "@/lib/data/analytics";
import { getTrainingIcon, getTrainingLevel } from "@/lib/training-icons";
import type { LessonStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { tenant } from "@/tenant";
import { labels } from "@/lib/labels";
import { getCourse, getMemberCourse } from "@/lib/data/courses";
import { courseProgress } from "@/lib/courses/progress";
import { churchToday, getMemberAttendance } from "@/lib/data/attendance";
import { ATTENDANCE_RULES, attendanceStatus, consecutiveMissedSundays, sundayServicesFor } from "@/lib/attendance/rules";
import { FollowUpDialog, OUTCOMES } from "@/components/attendance/follow-up-dialog";
import { ConfirmVisitorButton } from "@/components/attendance/confirm-visitor-button";
import { MemberDataActions } from "@/components/members/member-data-actions";
import { RoleCard } from "@/components/members/role-card";
import { DepartmentsField } from "@/components/members/departments-field";
import { getDepartmentMemberships, getDepartments } from "@/lib/data/departments";
import { assignableRoles, roleOption } from "@/lib/roles";
import { formatBirthday } from "@/lib/birthday";
import { MemberFieldsCard } from "@/components/members/member-fields-card";
import { getMemberFields, getMemberFieldValues } from "@/lib/data/member-fields";
import { leaderFieldAccess } from "@/lib/custom-fields";
import { getModules } from "@/lib/modules-server";

const STATUS_META: Record<LessonStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "text-emerald-600" },
  in_progress: { label: "In progress", className: "text-amber-600" },
  not_started: { label: "Not started", className: "text-muted-foreground" },
};

export default async function MemberPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const profile = await getCurrentProfile();
  const modules = await getModules();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const member = getMember(ds, memberId);

  if (!member) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This member doesn&apos;t exist.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }
  const [customFields, customValues] = await Promise.all([getMemberFields(profile.zoneId), getMemberFieldValues([member.id])]);
  const ownValues = customValues.get(member.id) ?? {};
  const customEntries = customFields
    .filter((f) => !f.archived)
    .map((field) => ({ field, value: ownValues[field.id], ...leaderFieldAccess(field, (c) => can(profile, c)) }))
    .filter((e) => e.see)
    .map(({ field, value, edit }) => ({ field, value, editable: edit }));
  const ageGroupLabel = tenant.ageGroups?.find((g) => g.key === member.ageGroup)?.label;

  const church = getChurch(ds, member.churchId);
  const cell = member.cellId ? (await getChapterCells(member.churchId)).cells.find((c) => c.id === member.cellId) : undefined;
  const country = getCountry(ds, member.countryId);
  const totalGiving = memberTotalGiving(member);
  // Individual giving is visible to leaders who may see it (and RLS returns
  // nothing otherwise); the card colour only where the Handbook is on.
  const showContributions = ds.individualGiving && modules.giving;
  const handbookRules = showContributions && modules.handbook ? await getHandbookRules(profile.zoneId) : null;
  const tenure = memberTenureYears(member);
  const completed = member.trainings.filter((t) => t.status === "completed").length;
  const trainingPoints = memberTrainingPoints(member);
  const level = getTrainingLevel(trainingPoints);
  const single = ds.countries.length === 1;
  const [departments, memberships] = await Promise.all([getDepartments(), getDepartmentMemberships()]);
  const memberDepartments = memberships[member.id] ?? [];
  const showAttendance = modules.attendance && can(profile, "view_attendance");
  const att = showAttendance ? await getMemberAttendance(member.id, member.churchId) : undefined;
  const today = churchToday();
  const sundays = att ? sundayServicesFor(att.services, member.churchId, today) : [];
  const standing = att ? attendanceStatus(sundays, att.attended, today) : undefined;
  const missed = att && sundays.length ? consecutiveMissedSundays(sundays, att.attended) : 0;
  const course = modules.courses ? await getCourse(profile.zoneId) : undefined;
  const memberCourse = course ? await getMemberCourse(member.id) : undefined;
  const courseDone = course && memberCourse
    ? courseProgress(memberCourse.attended.map((a) => a.classId), course.classes.map((c) => c.id), course.requiredClasses)
    : undefined;
  const LevelIcon = level.icon;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: single ? labels.locations : (country?.name ?? labels.country), href: `/countries/${member.countryId}` },
          { label: church?.name ?? labels.location, href: `/churches/${member.churchId}` },
          { label: memberFullName(member) },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {can(profile, "manage_members") ? (
          <MemberPhotoUpload
            memberId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            avatarColor={member.avatarColor}
            photoUrl={member.photoUrl}
          />
        ) : (
          <MemberAvatar
            firstName={member.firstName}
            lastName={member.lastName}
            avatarColor={member.avatarColor}
            photoUrl={member.photoUrl}
            className="h-16 w-16 text-lg"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{memberFullName(member)}</h1>
            {member.isVisitor && <Badge className="font-normal">First-timer</Badge>}
            <Badge variant="secondary" className="font-normal">
              {isLeader(member.position) ? positionLabel(member.position) : member.title || member.role}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <Link href={`/churches/${member.churchId}`} className="hover:text-primary transition-colors">
              {church?.name}
            </Link>
            {cell && (
              <Link href={`/churches/${member.churchId}#cells`} className="hover:text-primary transition-colors">
                {cell.name}
              </Link>
            )}
            {!single && (
              <span className="flex items-center gap-1">
                {country?.flag} {country?.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {member.joinDate
                ? `Joined ${new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Join date not recorded"}
            </span>
          </div>
          {(member.email || member.phone) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" /> {member.email}
                </a>
              )}
              {member.phone && (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> {member.phone}
                </span>
              )}
            </div>
          )}
          {departments.length > 0 || can(profile, "manage_settings") ? (
            <div className="mt-2">
              <DepartmentsField
                memberId={member.id}
                firstName={member.firstName}
                departments={departments}
                selected={memberDepartments}
                canEdit={can(profile, "manage_members")}
                canDefine={can(profile, "manage_settings")}
              />
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {member.isVisitor && can(profile, "manage_members") && <ConfirmVisitorButton memberId={member.id} />}
            <InviteMemberButton
              memberId={member.id}
              hasPortalAccess={member.hasPortalAccess}
              hasEmail={!!member.email}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ds.individualGiving && (
          <StatCard label="Total giving" value={formatMoney(totalGiving, currency, rates)} icon={HandCoins} />
        )}
        <StatCard label={`Time in ${tenant.name}`} value={formatTenure(tenure)} icon={Clock} />
        {modules.training && (
          <StatCard label="Trainings complete" value={`${completed}/${member.trainings.length}`} icon={CheckCircle2} />
        )}
        {standing && (
          <StatCard
            label="Attendance"
            value={standing === "active" ? "Active" : standing === "irregular" ? "Irregular" : "Not enough data"}
            icon={CheckCircle2}
          />
        )}
        {att && (
          <StatCard
            label="Missed in a row"
            value={sundays.length ? `${missed} Sunday${missed === 1 ? "" : "s"}` : "—"}
            icon={Calendar}
          />
        )}
        {ds.individualGiving && (
          <StatCard
            label="Avg. gift"
            value={formatMoney(member.giving.length ? totalGiving / member.giving.length : 0, currency, rates)}
            icon={HandCoins}
          />
        )}
      </div>

      {showContributions && (
        <ContributionsCard
          summary={summariseContributions(member.giving)}
          standing={handbookRules ? memberStanding(handbookRules.rules, member.giving) : null}
          currency={currency}
          rates={rates}
          self={false}
        />
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {ds.individualGiving && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Giving history</CardTitle>
              <CardDescription>Last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              {member.giving.length > 0 ? (
                <MemberGivingChart data={sumByMonth(member.giving)} currency={currency} rates={rates} />
              ) : (
                <p className="text-sm text-muted-foreground py-10 text-center">No giving recorded yet.</p>
              )}
            </CardContent>
          </Card>
        )}

        {modules.training && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Training &amp; lessons</CardTitle>
              <CardDescription>Discipleship progress</CardDescription>
            </div>
            {trainingPoints > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium shrink-0">
                <LevelIcon className="h-3.5 w-3.5 text-primary" />
                {level.name} &middot; {trainingPoints} pts
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {member.trainings.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No trainings assigned yet.</p>
            )}
            {member.trainings.map((t) => {
              const meta = STATUS_META[t.status];
              const TrainingIcon = getTrainingIcon(t.icon);
              return (
                <div key={t.id} className="flex items-start gap-2.5">
                  <TrainingIcon className={cn("h-4 w-4 shrink-0 mt-0.5", meta.className)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className={cn("text-xs", meta.className)}>{meta.label}</p>
                      {t.videoUrl && (
                        <a
                          href={t.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Video className="h-3 w-3" /> Video
                        </a>
                      )}
                    </div>
                  </div>
                  <TrainingStatusButton trainingId={t.id} status={t.status} />
                </div>
              );
            })}
          </CardContent>
        </Card>
        )}
        {course && courseDone && memberCourse && (
          <Card className={!ds.individualGiving && !modules.training ? "lg:col-span-3" : undefined}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle>{course.name}</CardTitle>
                <CardDescription>
                  {courseDone.completed
                    ? "Completed"
                    : memberCourse.cohorts.length
                      ? `${courseDone.attended} of ${courseDone.required} classes`
                      : "Not started"}
                  {memberCourse.cohorts.length > 0 && ` · ${memberCourse.cohorts.map((c) => c.name).join(", ")}`}
                </CardDescription>
              </div>
              {courseDone.completed && <Badge>Completed</Badge>}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {course.classes.map((c) => {
                  const a = memberCourse.attended.find((x) => x.classId === c.id);
                  return (
                    <span
                      key={c.id}
                      title={a ? `Attended ${a.date}` : c.title || undefined}
                      className={`rounded-md px-2 py-1 text-xs ${a ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {c.title ? `${c.number}. ${c.title}` : `Class ${c.number}`}
                    </span>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {att && (
          <Card className={!ds.individualGiving && !modules.training ? "lg:col-span-3" : undefined}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle>Recent Sundays</CardTitle>
                <CardDescription>At {church?.name}, newest first</CardDescription>
              </div>
              {missed >= ATTENDANCE_RULES.absenceAlertAfter && can(profile, "record_follow_up") && (
                <FollowUpDialog memberId={member.id} memberName={memberFullName(member)} />
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {sundays.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Sunday services checked in yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sundays.slice(0, 8).map((s) => (
                    <span
                      key={s.id}
                      title={s.date}
                      className={`rounded-md px-2 py-1 text-xs ${att.attended.has(s.id) ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {new Date(`${s.date}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                    </span>
                  ))}
                </div>
              )}
              {att.followUps.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Follow-ups</p>
                  {att.followUps.map((f) => (
                    <div key={f.id} className="text-sm">
                      <span className="font-medium">{OUTCOMES.find((o) => o.value === f.outcome)?.label ?? f.outcome}</span>
                      <span className="text-muted-foreground"> · {new Date(f.createdAt).toLocaleDateString("en-ZA")}</span>
                      {f.note && <p className="text-xs text-muted-foreground">{f.note}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {(can(profile, "assign_roles") || can(profile, "manage_access") || isLeader(member.position)) && (
        <RoleCard
          memberId={member.id}
          firstName={member.firstName}
          current={roleOption(member.position, modules)}
          options={assignableRoles(profile.position, modules)}
          canChange={
            (can(profile, "assign_roles") || can(profile, "manage_access")) &&
            member.profileId !== profile.userId &&
            canActOn(profile.position, member.position)
          }
          hasLogin={member.hasPortalAccess}
          cellsHref={`/churches/${member.churchId}#cells`}
        />
      )}

      {can(profile, "manage_members") && (
        <div className="flex justify-end">
          <MemberDataActions memberId={member.id} fullName={memberFullName(member)} backHref={`/churches/${member.churchId}`} />
        </div>
      )}

      {(member.profession || member.spouseName || member.birthday || member.weddingAnniversary || member.kcHandle || ageGroupLabel) && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>From imported records</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
            {ageGroupLabel && (
              <div>
                <p className="text-xs text-muted-foreground">Age group</p>
                <p className="font-medium">{ageGroupLabel}</p>
              </div>
            )}
            {member.profession && (
              <div>
                <p className="text-xs text-muted-foreground">Profession</p>
                <p className="font-medium">{member.profession}</p>
              </div>
            )}
            {member.spouseName && (
              <div>
                <p className="text-xs text-muted-foreground">Spouse</p>
                <p className="font-medium">{member.spouseName}</p>
              </div>
            )}
            {member.birthday && (
              <div>
                <p className="text-xs text-muted-foreground">Birthday</p>
                <p className="font-medium">{formatBirthday(member.birthday)}</p>
              </div>
            )}
            {member.weddingAnniversary && (
              <div>
                <p className="text-xs text-muted-foreground">Wedding anniversary</p>
                <p className="font-medium">{member.weddingAnniversary}</p>
              </div>
            )}
            {member.kcHandle && (
              <div>
                <p className="text-xs text-muted-foreground">KC handle</p>
                <p className="font-medium">{member.kcHandle}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <MemberFieldsCard memberId={member.id} entries={customEntries} />
    </div>
  );
}
