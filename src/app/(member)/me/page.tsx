import { redirect } from "next/navigation";
import { Calendar, HandCoins, Clock, CheckCircle2, Video } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { MemberGivingChart } from "@/components/charts/member-giving-chart";
import { ContactInfoForm } from "@/components/member-portal/contact-info-form";
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

export default async function MyProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.linkedMemberId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account isn&apos;t linked to a member record yet — contact your zone admin.
      </p>
    );
  }

  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const member = getMember(ds, profile.linkedMemberId);
  if (!member) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t find your member record.</p>;
  }

  const church = getChurch(ds, member.churchId);
  const country = getCountry(ds, member.countryId);
  const totalGiving = memberTotalGiving(member);
  const tenure = memberTenureYears(member);
  const completed = member.trainings.filter((t) => t.status === "completed").length;
  const trainingPoints = memberTrainingPoints(member);
  const level = getTrainingLevel(trainingPoints);
  const LevelIcon = level.icon;
  const progressPct = member.trainings.length > 0 ? Math.round((completed / member.trainings.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg font-semibold text-white" style={{ backgroundColor: member.avatarColor }}>
            {member.firstName[0]}
            {member.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{memberFullName(member)}</h1>
            <Badge variant="secondary" className="font-normal">{member.role}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span>{church?.name}</span>
            <span className="flex items-center gap-1">
              {country?.flag} {country?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total giving" value={formatMoney(totalGiving, currency, rates)} icon={HandCoins} />
        <StatCard label="Time in Haven" value={tenure < 0.1 ? "New" : `${tenure.toFixed(1)} yrs`} icon={Clock} />
        <StatCard label="Trainings complete" value={`${completed}/${member.trainings.length}`} icon={CheckCircle2} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Your giving history</CardTitle>
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
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Training &amp; lessons</CardTitle>
                <CardDescription>Your discipleship progress</CardDescription>
              </div>
              {trainingPoints > 0 && (
                <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium shrink-0">
                  <LevelIcon className="h-3.5 w-3.5 text-primary" />
                  {level.name}
                </div>
              )}
            </div>
            {member.trainings.length > 0 && (
              <div className="pt-2 space-y-1.5">
                <Progress value={progressPct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {completed}/{member.trainings.length} complete &middot; {trainingPoints} points
                </p>
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

      <Card>
        <CardHeader>
          <CardTitle>Contact info</CardTitle>
          <CardDescription>Keep your email and phone up to date.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactInfoForm email={member.email} phone={member.phone} />
        </CardContent>
      </Card>
    </div>
  );
}
