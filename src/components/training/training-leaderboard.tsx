import Link from "next/link";
import { MemberAvatar } from "@/components/members/member-avatar";
import { getChurch, memberFullName, type Dataset } from "@/lib/data/analytics";
import { getTrainingLevel } from "@/lib/training-icons";
import type { Member } from "@/lib/data/types";

export function TrainingLeaderboard({
  rows,
  ds,
  linkToProfile = true,
}: {
  rows: { member: Member; points: number }[];
  ds: Dataset;
  // Staff can drill into a member's full profile; a member browsing this
  // same leaderboard on their own Training page can't (that route is
  // staff-only), so rows render as plain, unlinked cards for them instead.
  linkToProfile?: boolean;
}) {
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
        const rowContent = (
          <>
            <span className="w-5 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
            <MemberAvatar
              firstName={member.firstName}
              lastName={member.lastName}
              avatarColor={member.avatarColor}
              photoUrl={member.photoUrl}
              className="h-8 w-8 text-xs"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{memberFullName(member)}</p>
              <p className="text-xs text-muted-foreground truncate">{church?.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-medium">
              <LevelIcon className="h-3.5 w-3.5 text-primary" />
              {level.name}
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0 w-12 text-right">{points} pts</span>
          </>
        );
        return linkToProfile ? (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors group"
          >
            {rowContent}
          </Link>
        ) : (
          <div key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}
