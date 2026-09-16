import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getChurch, memberFullName } from "@/lib/data/analytics";
import type { Member } from "@/lib/data/types";

export function TopGivers({ givers }: { givers: { member: Member; total: number }[] }) {
  const max = givers[0]?.total ?? 1;
  return (
    <div className="space-y-1">
      {givers.map(({ member, total }, i) => {
        const church = getChurch(member.churchId);
        return (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors group"
          >
            <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-xs font-semibold text-white"
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.firstName[0]}
                {member.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                {memberFullName(member)}
              </p>
              <p className="text-xs text-muted-foreground truncate">{church?.name}</p>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(6, (total / max) * 100)}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0">
              ${total.toLocaleString()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
