import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingHero } from "@/components/training/training-hero";
import { TrainingCourseCard } from "@/components/training/training-course-card";
import { TrainingLeaderboard } from "@/components/training/training-leaderboard";
import { BadgesPanel } from "@/components/training/badges-panel";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getMember, getTrainingLeaderboard, memberTrainingPoints } from "@/lib/data/analytics";
import { getMemberAchievementStats } from "@/lib/data/achievements";
import { getEarnedBadges } from "@/lib/badges";

export default async function MemberTrainingPage() {
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
  const member = getMember(ds, profile.linkedMemberId);
  if (!member) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t find your member record.</p>;
  }

  const completed = member.trainings.filter((t) => t.status === "completed").length;
  const trainingPoints = memberTrainingPoints(member);
  const leaderboard = getTrainingLeaderboard(ds, 10);
  const achievements = await getMemberAchievementStats(member.id);
  const badges = getEarnedBadges({
    lessonsCompleted: achievements.lessonsCompleted,
    coursesCompleted: completed,
    trainingPoints,
    achievements,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
        <p className="text-sm text-muted-foreground">Programs assigned to you — watch the video, then mark your progress.</p>
      </div>

      <TrainingHero points={trainingPoints} completed={completed} total={member.trainings.length} streak={achievements.streak.current} />

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Courses</h2>
          {member.trainings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              No trainings assigned yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {member.trainings.map((t) => (
                <TrainingCourseCard
                  key={t.id}
                  programId={t.programId}
                  name={t.name}
                  description={t.description}
                  icon={t.icon}
                  points={t.points}
                  status={t.status}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <BadgesPanel badges={badges} />
          <Card>
            <CardHeader>
              <CardTitle>Top learners</CardTitle>
              <CardDescription>By training points, zone-wide</CardDescription>
            </CardHeader>
            <CardContent>
              <TrainingLeaderboard rows={leaderboard} ds={ds} linkToProfile={false} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
