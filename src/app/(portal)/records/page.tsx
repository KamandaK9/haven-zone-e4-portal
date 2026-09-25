import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Landmark, Mail, NotebookPen, ReceiptText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChapterPicker } from "@/components/records/chapter-picker";
import { ChequeRegister } from "@/components/records/cheque-register";
import { RecordRegister } from "@/components/records/record-register";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getChapterCheques, getChapterMeetings, getChapterRecords, getRecordChapters } from "@/lib/data/records";
import { getDisplayCurrency } from "@/lib/currency-server";
import type { ChapterRecordKind } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { tenant } from "@/tenant";

const TABS = [
  { key: "minutes", label: "Minutes", icon: NotebookPen, cap: "manage_records", blurb: "Minutes of every executive meeting, with attendance and decisions." },
  { key: "correspondence", label: "Correspondence", icon: Mail, cap: "manage_records", blurb: "Letters received and sent, filed with their scans." },
  { key: "bank_advice", label: "Bank advices", icon: Landmark, cap: "manage_ledger", blurb: "Bank allocation advices for each account." },
  { key: "cheques", label: "Cheques", icon: ReceiptText, cap: "manage_ledger", blurb: "Every cheque stub — issued, cleared, cancelled or void." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role === "member") redirect("/me");
  const tabs = TABS.filter((t) => can(profile, t.cap));
  if (tabs.length === 0) redirect("/dashboard");

  const query = await searchParams;
  const tab = tabs.find((t) => t.key === query.tab) ?? tabs[0];
  const chapters = await getRecordChapters();
  const chapter = chapters.find((c) => c.id === query.chapter) ?? chapters.find((c) => c.id === profile.churchId) ?? chapters[0];
  const href = (patch: { tab?: TabKey; chapter?: string }) =>
    `/records?${new URLSearchParams({ tab: patch.tab ?? tab.key, chapter: patch.chapter ?? chapter?.id ?? "" })}`;

  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const [records, cheques, meetings] = chapter
    ? await Promise.all([
        tab.key === "cheques" ? null : getChapterRecords(chapter.id, tab.key as ChapterRecordKind),
        tab.key === "cheques" ? getChapterCheques(chapter.id) : null,
        tab.key === "minutes" ? getChapterMeetings(chapter.id) : [],
      ])
    : [null, null, []];
  const notReady = chapter && (tab.key === "cheques" ? cheques === null : records === null);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Records</h1>
          <p className="text-sm text-muted-foreground">The paperwork every chapter keeps, filed with its scans.</p>
        </div>
        {chapters.length > 1 && chapter && (
          <ChapterPicker chapters={chapters} value={chapter.id} tab={tab.key} />
        )}
      </div>

      <nav aria-label="Record types" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.key === tab.key;
          return (
            <Link
              key={t.key}
              href={href({ tab: t.key })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>
            {tab.label}
            {chapter && <span className="font-normal text-muted-foreground"> · {chapter.name}</span>}
          </CardTitle>
          <CardDescription>{tab.blurb}</CardDescription>
        </CardHeader>
        <CardContent>
          {!chapter ? (
            <p className="text-sm text-muted-foreground">There are no chapters in your area yet.</p>
          ) : notReady ? (
            <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              Records aren&apos;t set up in the database yet — apply the latest migration.
            </p>
          ) : tab.key === "cheques" ? (
            <ChequeRegister
              key={chapter.id}
              churchId={chapter.id}
              cheques={cheques ?? []}
              accounts={tenant.records.bankAccounts}
              currency={currency}
              rates={rates}
              canSeeLedger={can(profile, "manage_ledger")}
            />
          ) : (
            <RecordRegister
              key={`${tab.key}-${chapter.id}`}
              kind={tab.key}
              churchId={chapter.id}
              records={records ?? []}
              options={{
                accounts: tenant.records.bankAccounts,
                meetingTypes: tenant.records.meetingTypes,
                meetings,
                currency,
                rates,
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
