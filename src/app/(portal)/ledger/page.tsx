import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { AddLedgerEntryDialog } from "@/components/ledger/add-ledger-entry-dialog";
import { ImportGivingDialog } from "@/components/ledger/import-giving-dialog";
import { ImportLedgerDialog } from "@/components/ledger/import-ledger-dialog";
import { ReconcileDialog } from "@/components/ledger/reconcile-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can, getCurrentProfile, getLedgerEntries, getReconciliations, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";

export default async function LedgerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role === "member") redirect("/me");
  if (!can(profile, "manage_ledger")) redirect("/dashboard");

  const [ds, entries, reconciliations, { currency, rates }] = await Promise.all([
    getZoneDataset(profile.zoneId),
    getLedgerEntries(profile.zoneId),
    getReconciliations(profile.zoneId),
    getDisplayCurrency(profile.zoneCurrency),
  ]);

  // getReconciliations already orders by period_end desc, so the first
  // match per church is its most recent reconciliation.
  const lastReconciliationByChurch = new Map<string, (typeof reconciliations)[number]>();
  for (const r of reconciliations) {
    if (!lastReconciliationByChurch.has(r.churchId)) lastReconciliationByChurch.set(r.churchId, r);
  }

  const totalIncome = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - totalExpense;

  const churchById = new Map(ds.churches.map((c) => [c.id, c]));
  const byChurch = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const row = byChurch.get(e.churchId) ?? { income: 0, expense: 0 };
    if (e.type === "income") row.income += e.amount;
    else row.expense += e.amount;
    byChurch.set(e.churchId, row);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted-foreground">Income and expenses across {ds.zoneName}.</p>
        </div>
        {ds.churches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {can(profile, "import_giving") && (
              <ImportGivingDialog
                members={ds.members.map((m) => ({
                  id: m.id,
                  firstName: m.firstName,
                  lastName: m.lastName,
                  email: m.email,
                  churchId: m.churchId,
                }))}
                churches={ds.churches}
                currency={currency}
                rates={rates}
              />
            )}
            <ImportLedgerDialog churches={ds.churches} />
            <AddLedgerEntryDialog churches={ds.churches} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total income" value={formatMoney(totalIncome, currency, rates)} icon={TrendingUp} />
        <StatCard label="Total expenses" value={formatMoney(totalExpense, currency, rates)} icon={TrendingDown} />
        <StatCard label="Net balance" value={formatMoney(balance, currency, rates)} icon={Scale} />
      </div>

      {ds.churches.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              Add a church from Countries first before recording ledger entries.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Balance by church</CardTitle>
              <CardDescription>Income minus expenses, all time</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ds.churches.map((church) => {
                const row = byChurch.get(church.id) ?? { income: 0, expense: 0 };
                const churchBalance = row.income - row.expense;
                const lastReconciliation = lastReconciliationByChurch.get(church.id);
                return (
                  <div key={church.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{church.name}</p>
                      {lastReconciliation && (
                        <Badge
                          variant="secondary"
                          className={`font-normal mt-0.5 ${
                            lastReconciliation.variance === 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {lastReconciliation.variance === 0 ? "Balanced" : "Needs review"}
                          {" · "}
                          {new Date(lastReconciliation.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <p className={`text-sm font-semibold tabular-nums ${churchBalance < 0 ? "text-red-600" : ""}`}>
                        {formatMoney(churchBalance, currency, rates)}
                      </p>
                      <ReconcileDialog church={church} currency={currency} rates={rates} lastReconciliation={lastReconciliation} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All entries</CardTitle>
              <CardDescription>Most recent first</CardDescription>
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                  No ledger entries yet.
                </p>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Church</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(e.entryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </TableCell>
                          <TableCell className="text-sm">{churchById.get(e.churchId)?.name ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                e.type === "income"
                                  ? "bg-emerald-50 text-emerald-700 font-normal"
                                  : "bg-red-50 text-red-700 font-normal"
                              }
                            >
                              {e.type === "income" ? "Income" : "Expense"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {e.category}
                            {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                          </TableCell>
                          <TableCell
                            className={`text-right text-sm font-semibold tabular-nums ${e.type === "expense" ? "text-red-600" : ""}`}
                          >
                            {e.type === "expense" ? "-" : ""}
                            {formatMoney(e.amount, currency, rates)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
