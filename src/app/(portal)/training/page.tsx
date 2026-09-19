import { redirect } from "next/navigation";
import Link from "next/link";
import { Video, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateProgramDialog } from "@/components/training/create-program-dialog";
import { AssignTrainingDialog } from "@/components/training/assign-training-dialog";
import { TrainingLeaderboard } from "@/components/training/training-leaderboard";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getTrainingLeaderboard } from "@/lib/data/analytics";
import { getTrainingIcon } from "@/lib/training-icons";

export default async function TrainingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role === "member") redirect("/me");

  const ds = await getZoneDataset(profile.zoneId);
  const leaderboard = getTrainingLeaderboard(ds, 10);

  const statsByProgram = new Map<string, { assigned: number; completed: number }>();
  for (const m of ds.members) {
    for (const t of m.trainings) {
      const row = statsByProgram.get(t.programId) ?? { assigned: 0, completed: 0 };
      row.assigned++;
      if (t.status === "completed") row.completed++;
      statsByProgram.set(t.programId, row);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
          <p className="text-sm text-muted-foreground">
            Programs members work through — assign them, link a video, and track who&apos;s finished.
          </p>
        </div>
        <CreateProgramDialog />
      </div>

      {ds.trainingPrograms.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              No training programs yet. Create one to get started — new members will still get the default set
              automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ds.trainingPrograms.map((program) => {
            const Icon = getTrainingIcon(program.icon);
            const stats = statsByProgram.get(program.id) ?? { assigned: 0, completed: 0 };
            return (
              <Card key={program.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base leading-tight">{program.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="font-normal shrink-0">
                      {program.points} pts
                    </Badge>
                  </div>
                  {program.description && <CardDescription className="pt-1">{program.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {program.videoUrl && (
                    <a
                      href={program.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Video className="h-3.5 w-3.5" /> Watch video
                    </a>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users2 className="h-3.5 w-3.5" />
                    {stats.completed}/{stats.assigned} completed
                  </div>
                  <AssignTrainingDialog program={program} countries={ds.countries} churches={ds.churches} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Top members by training points, zone-wide</CardDescription>
          </div>
          <Link href="/dashboard" className="text-xs font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        </CardHeader>
        <CardContent>
          <TrainingLeaderboard rows={leaderboard} ds={ds} />
        </CardContent>
      </Card>
    </div>
  );
}
