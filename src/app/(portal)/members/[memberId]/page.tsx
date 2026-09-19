import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Phone, Calendar, HandCoins, Clock, CheckCircle2, Video } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberGivingChart } from "@/components/charts/member-giving-chart";
import { InviteMemberButton } from "@/components/members/invite-member-button";
import { TrainingStatusButton } from "@/components/training/training-status-button";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurch,
  getCountry,
  getMember,
  memberFullName,
  memberTenureYears,
  memberTotalGiving,
  memberTrainingPoints,
} from "@/lib/data/analytics";
import { getTrainingIcon, getTrainingLevel } from "@/lib/training-icons";
import type { LessonStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

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
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const member = getMember(ds, memberId);

  if (!member) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Zone Dashboard", href: "/dashboard" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This member doesn&apos;t exist.</p>
        <Link href="/dashboard" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const church = getChurch(ds, member.churchId);
  const country = getCountry(ds, member.countryId);
  const totalGiving = memberTotalGiving(member);
  const tenure = memberTenureYears(member);
  const completed = member.trainings.filter((t) => t.status === "completed").length;
  const trainingPoints = memberTrainingPoints(member);
  const level = getTrainingLevel(trainingPoints);
  const LevelIcon = level.icon;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Zone Dashboard", href: "/dashboard" },
          { label: country?.name ?? "Country", href: `/countries/${member.countryId}` },
          { label: church?.name ?? "Church", href: `/churches/${member.churchId}` },
          { label: memberFullName(member) },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback
            className="text-lg font-semibold text-white"
            style={{ backgroundColor: member.avatarColor }}
          >
            {member.firstName[0]}
            {member.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{memberFullName(member)}</h1>
            <Badge variant="secondary" className="font-normal">{member.title || member.role}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <Link href={`/churches/${member.churchId}`} className="hover:text-primary transition-colors">
              {church?.name}
            </Link>
            <span className="flex items-center gap-1">
              {country?.flag} {country?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
          <div className="mt-3">
            <InviteMemberButton
              memberId={member.id}
              hasPortalAccess={member.hasPortalAccess}
              hasEmail={!!member.email}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total giving" value={formatMoney(totalGiving, currency, rates)} icon={HandCoins} />
        <StatCard label="Time in Haven" value={tenure < 0.1 ? "New" : `${tenure.toFixed(1)} yrs`} icon={Clock} />
        <StatCard label="Trainings complete" value={`${completed}/${member.trainings.length}`} icon={CheckCircle2} />
        <StatCard
          label="Avg. gift"
          value={formatMoney(member.giving.length ? totalGiving / member.giving.length : 0, currency, rates)}
          icon={HandCoins}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Giving history</CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {member.giving.length > 0 ? (
              <MemberGivingChart data={member.giving} currency={currency} rates={rates} />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No giving recorded yet.</p>
            )}
          </CardContent>
        </Card>

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
      </div>

      {(member.profession || member.spouseName || member.birthday || member.weddingAnniversary || member.kcHandle) && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>From the leadership roster import</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
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
                <p className="font-medium">{member.birthday}</p>
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
    </div>
  );
}
