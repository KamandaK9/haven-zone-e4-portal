import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getChurch, memberFullName, type Dataset } from "@/lib/data/analytics";
import { getTrainingLevel } from "@/lib/training-icons";
import type { Member } from "@/lib/data/types";

export function TrainingLeaderboard({ rows, ds }: { rows: { member: Member; points: number }[]; ds: Dataset }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        No completed trainings yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map(({ member, points }, i) => {
        const church = getChurch(ds, member.churchId);
        const level = getTrainingLevel(points);
        const LevelIcon = level.icon;
        return (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors group"
          >
            <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: member.avatarColor }}>
                {member.firstName[0]}
                {member.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{memberFullName(member)}</p>
              <p className="text-xs text-muted-foreground truncate">{church?.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
              <LevelIcon className="h-3.5 w-3.5 text-primary" />
              {level.name}
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0 w-12 text-right">{points} pts</span>
          </Link>
        );
      })}
    </div>
  );
}
