import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DuplicatePairCard } from "@/components/members/duplicate-pair-card";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { findDuplicateMemberPairs } from "@/lib/data/duplicates";
import { getChurch } from "@/lib/data/analytics";
import { pluralize } from "@/lib/utils";

export default async function DuplicateMembersPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_members")) redirect("/dashboard");

  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  // ds.members is already scoped by RLS to whatever this profile may see —
  // a Governor's own chapter, a Director the whole zone — so the scan never
  // needs to know that itself.
  const pairs = findDuplicateMemberPairs(ds.members);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Link href="/countries" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Countries
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Duplicate members</h1>
          <p className="text-sm text-muted-foreground">
            People who look like the same person, within what you can see. Nothing is combined until you choose which
            record to keep.
          </p>
        </div>
      </div>

      {pairs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users2 className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No likely duplicates found</p>
              <p className="text-xs text-muted-foreground">Checked matching email, phone, and same-name-same-chapter.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {pluralize(pairs.length, "possible duplicate")} found. Merging moves giving and training history onto the
            record you keep — nothing is lost.
          </p>
          <div className="space-y-3">
            {pairs.map(({ a, b, reasons }) => (
              <DuplicatePairCard
                key={`${a.id}|${b.id}`}
                a={a}
                b={b}
                churchNameA={getChurch(ds, a.churchId)?.name ?? "—"}
                churchNameB={getChurch(ds, b.churchId)?.name ?? "—"}
                reasons={reasons}
                showGiving={ds.individualGiving}
                currency={currency}
                rates={rates}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
