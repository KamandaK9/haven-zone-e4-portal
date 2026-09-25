import Link from "next/link";
import { MemberAvatar } from "@/components/members/member-avatar";
import { getChurch, memberFullName, type Dataset } from "@/lib/data/analytics";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { Member } from "@/lib/data/types";

export function TopGivers({
  givers,
  ds,
  currency = "USD",
  rates = {},
}: {
  givers: { member: Member; total: number }[];
  ds: Dataset;
  currency?: CurrencyCode;
  rates?: Record<string, number>;
}) {
  const max = givers[0]?.total ?? 1;

  if (givers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        No giving recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {givers.map(({ member, total }, i) => {
        const church = getChurch(ds, member.churchId);
        return (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent transition-colors group"
          >
            <span className="w-5 text-center text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <MemberAvatar
              firstName={member.firstName}
              lastName={member.lastName}
              avatarColor={member.avatarColor}
              photoUrl={member.photoUrl}
              className="h-8 w-8 text-xs"
            />
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
              {formatMoney(total, currency, rates)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
