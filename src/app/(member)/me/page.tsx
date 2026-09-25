import Link from "next/link";
import { redirect } from "next/navigation";
import { Calendar, HandCoins, Clock, CheckCircle2, CalendarClock, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { MemberGivingChart } from "@/components/charts/member-giving-chart";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurch,
  getCountry,
  getMember,
  getUpcomingEvents,
  memberFullName,
  formatTenure,
  memberTenureYears,
  memberTotalGiving,
  memberTrainingPoints,
} from "@/lib/data/analytics";
import { sumByMonth } from "@/lib/giving";
import { getTrainingLevel } from "@/lib/training-icons";
import { getMemberAchievementStats } from "@/lib/data/achievements";
import { POSITION_LABELS } from "@/lib/access";
import { tenant } from "@/tenant";

export default async function MemberDashboardPage() {
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
  const events = getUpcomingEvents(ds, 4);
  const { streak } = await getMemberAchievementStats(member.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <MemberAvatar
          firstName={member.firstName}
          lastName={member.lastName}
          avatarColor={member.avatarColor}
          photoUrl={member.photoUrl}
          className="h-16 w-16 text-lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{memberFullName(member)}</h1>
            <Badge variant="secondary" className="font-normal">
              {member.position !== "member" ? POSITION_LABELS[member.position] : member.role}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
            <span>{church?.name}</span>
            <span className="flex items-center gap-1">
              {country?.flag} {country?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {member.joinDate
                ? `Joined ${new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Join date not recorded"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total giving" value={formatMoney(totalGiving, currency, rates)} icon={HandCoins} />
        <StatCard label={`Time in ${tenant.name}`} value={formatTenure(tenure)} icon={Clock} />
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
              <MemberGivingChart data={sumByMonth(member.giving)} currency={currency} rates={rates} />
            ) : (
              <p className="text-sm text-muted-foreground py-10 text-center">No giving recorded yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Training</CardTitle>
                <CardDescription>Your discipleship progress</CardDescription>
              </div>
              <Link href="/me/training" className="text-xs font-medium text-primary hover:underline shrink-0">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {member.trainings.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium w-fit">
                      <LevelIcon className="h-3.5 w-3.5 text-primary" />
                      {level.name} &middot; {trainingPoints} pts
                    </div>
                    {streak.current > 0 && (
                      <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 w-fit">
                        <Flame className="h-3.5 w-3.5" />
                        {streak.current} day{streak.current === 1 ? "" : "s"}
                      </div>
                    )}
                  </div>
                  <Progress value={progressPct} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {completed}/{member.trainings.length} complete
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No trainings assigned yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Upcoming events</CardTitle>
              <Link href="/me/calendar" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events.</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5 text-sm">
                    <CalendarClock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium leading-snug">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot; {e.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
