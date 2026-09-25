"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  UploadCloud,
  FileSpreadsheet,
  X,
  Globe2,
  Church as ChurchIcon,
  Users,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StepProgress } from "@/components/setup/step-progress";
import { STEP_LABELS, type WizardState, type WizardCountry } from "@/components/setup/types";
import { completeZoneSetup, type CompleteZoneSetupResult } from "@/lib/actions/setup";
import { createClient } from "@/lib/supabase/client";
import { parseStructureSheet } from "@/lib/import/parse-structure";
import { parseZoneMemberSheet } from "@/lib/import/parse-zone-members";
import {
  parseLeadershipRoster,
  normalizeChapterKey,
  type RosterPerson,
  type ChapterGroup,
} from "@/lib/import/parse-leadership-roster";
import { cn } from "@/lib/utils";
import { ZONE_COUNTRIES } from "@/lib/zone-countries";

const TOTAL_STEPS = STEP_LABELS.length;
const IMPORT_STEP = STEP_LABELS.indexOf("Import members") + 1;

const EMPTY_WIZARD: WizardState = {
  zoneName: "The Haven Zone E4",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
  adminPasswordConfirm: "",
  countries: ZONE_COUNTRIES.map((c) => ({ name: c.name, churches: [""] })),
  assistants: [{ name: "", email: "" }],
  importFileName: null,
  importedMembers: [],
  churchMeta: {},
};

type AssistantCredential = Extract<CompleteZoneSetupResult, { ok: true }>["assistantCredentials"];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(EMPTY_WIZARD);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assistantCredentials, setAssistantCredentials] = useState<AssistantCredential | null>(null);

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);

    const filteredCountries = wizard.countries.filter((c) => c.name.trim());
    const churchesByCountryIndex: Record<number, { name: string }[]> = {};
    filteredCountries.forEach((c, i) => {
      churchesByCountryIndex[i] = c.churches.filter((n) => n.trim()).map((n) => ({ name: n }));
    });

    const result = await completeZoneSetup({
      zoneName: wizard.zoneName,
      superAdmin: {
        name: wizard.adminName,
        email: wizard.adminEmail,
        phone: wizard.adminPhone,
        password: wizard.adminPassword,
      },
      countries: filteredCountries.map((c) => ({ name: c.name })),
      churchesByCountryIndex,
      assistants: wizard.assistants.filter((a) => a.name.trim() && a.email.trim()),
      importedMembers: wizard.importedMembers,
      churchMeta: wizard.churchMeta,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    // The server action used the admin API, so the browser has no session
    // yet — sign in for real now to establish one.
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: wizard.adminEmail,
      password: wizard.adminPassword,
    });
    if (signInError) {
      setSubmitError(`Zone created, but sign-in failed: ${signInError.message}. Try signing in from the login page.`);
      setSubmitting(false);
      return;
    }

    if (result.assistantCredentials.length > 0) {
      setAssistantCredentials(result.assistantCredentials);
      setSubmitting(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  const step1Valid =
    wizard.zoneName.trim() &&
    wizard.adminName.trim() &&
    wizard.adminEmail.trim() &&
    wizard.adminPassword.length >= 8 &&
    wizard.adminPassword === wizard.adminPasswordConfirm;

  if (assistantCredentials) {
    return <AssistantCredentialsScreen credentials={assistantCredentials} onContinue={() => router.push("/dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <datalist id="zone-countries">
        {ZONE_COUNTRIES.map((c) => (
          <option key={c.name} value={c.name} />
        ))}
      </datalist>
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <BrandMark size={32} />
          <div>
            <p className="font-semibold text-sm leading-tight">{wizard.zoneName || "Zone Setup"}</p>
            <p className="text-xs text-muted-foreground leading-tight">Let&apos;s set up your zone</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <StepProgress current={step} />

        <Card>
          <CardContent className="pt-6">
            {step === 1 && <StepZoneBasics wizard={wizard} setWizard={setWizard} />}
            {step === 2 && <StepCountriesAndChurches wizard={wizard} setWizard={setWizard} />}
            {step === 3 && <StepAssistants wizard={wizard} setWizard={setWizard} />}
            {step === IMPORT_STEP && <StepImport wizard={wizard} setWizard={setWizard} />}
            {step === TOTAL_STEPS && <StepReview wizard={wizard} />}
          </CardContent>
        </Card>

        {submitError && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={back} disabled={step === 1 || submitting} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <div className="flex items-center gap-2">
              {step === IMPORT_STEP && (
                <Button variant="ghost" onClick={next}>
                  Skip
                </Button>
              )}
              <Button onClick={next} disabled={step === 1 && !step1Valid} className="gap-2">
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {submitting ? "Setting up…" : "Complete setup"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantCredentialsScreen({
  credentials,
  onContinue,
}: {
  credentials: AssistantCredential;
  onContinue: () => void;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function copy(i: number, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i);
      setTimeout(() => setCopiedIndex((cur) => (cur === i ? null : cur)), 1500);
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-full bg-emerald-100 p-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold">Zone set up</p>
            <p className="text-sm text-muted-foreground mt-1">
              Share these one-time logins with your assistants before continuing — they won&apos;t be shown again.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            {credentials.map((c, i) => (
              <div key={c.email} className="rounded-lg border p-3 space-y-1.5">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.email}</p>
                {c.tempPassword ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono">{c.tempPassword}</code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copy(i, c.tempPassword)}
                    >
                      {copiedIndex === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Couldn&apos;t create this account — invite them from Settings later.
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={onContinue} className="w-full gap-2">
          Continue to dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepZoneBasics({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Zone basics</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Name your zone and set up your Super Admin account.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="zoneName">Zone name</Label>
        <Input
          id="zoneName"
          value={wizard.zoneName}
          onChange={(e) => setWizard((w) => ({ ...w, zoneName: e.target.value }))}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="adminName">Your name</Label>
          <Input
            id="adminName"
            placeholder="e.g. Pastor John Kamanda"
            value={wizard.adminName}
            onChange={(e) => setWizard((w) => ({ ...w, adminName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adminEmail">Your email</Label>
          <Input
            id="adminEmail"
            type="email"
            placeholder="you@havenzonee4.org"
            value={wizard.adminEmail}
            onChange={(e) => setWizard((w) => ({ ...w, adminEmail: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adminPhone">Your phone</Label>
          <Input
            id="adminPhone"
            placeholder="optional"
            value={wizard.adminPhone}
            onChange={(e) => setWizard((w) => ({ ...w, adminPhone: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adminPassword">Password</Label>
          <Input
            id="adminPassword"
            type="password"
            placeholder="At least 8 characters"
            value={wizard.adminPassword}
            onChange={(e) => setWizard((w) => ({ ...w, adminPassword: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adminPasswordConfirm">Confirm password</Label>
          <Input
            id="adminPasswordConfirm"
            type="password"
            value={wizard.adminPasswordConfirm}
            onChange={(e) => setWizard((w) => ({ ...w, adminPasswordConfirm: e.target.value }))}
            autoComplete="new-password"
          />
          {wizard.adminPasswordConfirm && wizard.adminPassword !== wizard.adminPasswordConfirm && (
            <p className="text-xs text-red-600">Passwords don&apos;t match.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You&apos;ll be the Super Admin for {wizard.zoneName || "this zone"} with full access. This is your real login
        — you&apos;ll use it to sign in from now on.
      </p>
    </div>
  );
}

function StepCountriesAndChurches({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [importState, setImportState] = useState<"idle" | "dragging" | "parsing" | "error">("idle");
  const [importSummary, setImportSummary] = useState<{ countries: number; churches: number; skipped: number } | null>(
    null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function updateCountryName(i: number, name: string) {
    setWizard((w) => ({
      ...w,
      countries: w.countries.map((c, idx) => (idx === i ? { ...c, name } : c)),
    }));
  }
  function addCountry() {
    setWizard((w) => ({ ...w, countries: [...w.countries, { name: "", churches: [""] }] }));
  }
  function removeCountry(i: number) {
    setWizard((w) => ({ ...w, countries: w.countries.filter((_, idx) => idx !== i) }));
  }
  function updateChurch(countryIndex: number, churchIndex: number, value: string) {
    setWizard((w) => ({
      ...w,
      countries: w.countries.map((c, idx) =>
        idx === countryIndex
          ? { ...c, churches: c.churches.map((ch, cIdx) => (cIdx === churchIndex ? value : ch)) }
          : c
      ),
    }));
  }
  function addChurch(countryIndex: number) {
    setWizard((w) => ({
      ...w,
      countries: w.countries.map((c, idx) => (idx === countryIndex ? { ...c, churches: [...c.churches, ""] } : c)),
    }));
  }
  function removeChurch(countryIndex: number, churchIndex: number) {
    setWizard((w) => ({
      ...w,
      countries: w.countries.map((c, idx) =>
        idx === countryIndex ? { ...c, churches: c.churches.filter((_, cIdx) => cIdx !== churchIndex) } : c
      ),
    }));
  }

  async function handleImportFile(file: File) {
    setImportState("parsing");
    setImportError(null);
    setImportSummary(null);
    try {
      const result = await parseStructureSheet(file);
      if (result.countries.length === 0) {
        setImportError(
          result.skipped[0]?.reason === 'No "Country" column found'
            ? 'No "Country" column found in that file. If this is the leadership roster workbook (one tab per sub-zone), skip this step and import it on the "Import members" step instead — it builds the countries and chapters for you.'
            : "No countries found in that file."
        );
        setImportState("error");
        return;
      }
      setWizard((w) => ({ ...w, countries: result.countries }));
      const churchCount = result.countries.reduce((sum, c) => sum + c.churches.filter((n) => n.trim()).length, 0);
      setImportSummary({ countries: result.countries.length, churches: churchCount, skipped: result.skipped.length });
      setImportState("idle");
    } catch {
      setImportError("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv.");
      setImportState("error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Countries &amp; churches</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add the countries and churches {wizard.zoneName || "your zone"} covers — type them in, or import a
          spreadsheet.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setImportState("dragging");
        }}
        onDragLeave={() => setImportState((s) => (s === "dragging" ? "idle" : s))}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleImportFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors",
          importState === "dragging" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
        />
        {importState === "parsing" ? (
          <p className="text-sm font-medium text-muted-foreground">Reading file…</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <UploadCloud className="h-4 w-4 text-muted-foreground" />
              Import from a spreadsheet
            </div>
            <p className="text-xs text-muted-foreground">
              One row per church, with a &quot;Country&quot; and &quot;Church&quot; column — .xlsx, .xls, .csv
            </p>
          </>
        )}
      </div>

      {importSummary && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Imported {importSummary.countries} countr{importSummary.countries === 1 ? "y" : "ies"} and{" "}
          {importSummary.churches} church{importSummary.churches === 1 ? "" : "es"}
          {importSummary.skipped > 0 ? ` — ${importSummary.skipped} row(s) skipped` : ""}. Edit below if needed.
        </div>
      )}
      {importState === "error" && importError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {importError}
        </div>
      )}

      <div className="space-y-4">
        {wizard.countries.map((c, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="e.g. Zambia"
                list="zone-countries"
                value={c.name}
                onChange={(e) => updateCountryName(i, e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeCountry(i)}
                disabled={wizard.countries.length === 1}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="pl-6 space-y-2">
              {c.churches.map((church, churchIdx) => (
                <div key={churchIdx} className="flex items-center gap-2">
                  <ChurchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="e.g. CE Lusaka Central"
                    value={church}
                    onChange={(e) => updateChurch(i, churchIdx, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChurch(i, churchIdx)}
                    disabled={c.churches.length === 1}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => addChurch(i)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add church
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={addCountry} className="gap-2">
        <Plus className="h-4 w-4" />
        Add country
      </Button>
    </div>
  );
}

function StepAssistants({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  function update(i: number, field: "name" | "email", value: string) {
    setWizard((w) => ({
      ...w,
      assistants: w.assistants.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));
  }
  function add() {
    setWizard((w) => ({ ...w, assistants: [...w.assistants, { name: "", email: "" }] }));
  }
  function remove(i: number) {
    setWizard((w) => ({ ...w, assistants: w.assistants.filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Assistant Zonal Directors</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add Assistant Zonal Directors who&apos;ll help run the zone. They get the same access you do, including
          managing everyone else&apos;s access. Other leaders are added later from the roster, by invite.
        </p>
      </div>
      <div className="space-y-2.5">
        {wizard.assistants.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Name"
              value={a.name}
              onChange={(e) => update(i, "name", e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Email"
              type="email"
              value={a.email}
              onChange={(e) => update(i, "email", e.target.value)}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              disabled={wizard.assistants.length === 1}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add} className="gap-2">
        <Plus className="h-4 w-4" />
        Add assistant
      </Button>
    </div>
  );
}

function StepImport({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [mode, setMode] = useState<"roster" | "simple">("roster");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Already have a spreadsheet of members?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Optional — import real data now, or skip and add members one by one later.
        </p>
      </div>

      <div className="flex gap-4 text-xs">
        <button
          type="button"
          onClick={() => setMode("roster")}
          className={cn(mode === "roster" ? "font-semibold text-foreground" : "text-muted-foreground hover:underline")}
        >
          Leadership roster + giving file
        </button>
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={cn(mode === "simple" ? "font-semibold text-foreground" : "text-muted-foreground hover:underline")}
        >
          Simple flat member list
        </button>
      </div>

      {mode === "roster" ? (
        <RosterImportPanel wizard={wizard} setWizard={setWizard} />
      ) : (
        <SimpleImportPanel wizard={wizard} setWizard={setWizard} />
      )}
    </div>
  );
}

function SimpleImportPanel({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [importStage, setImportStage] = useState<"idle" | "dragging" | "parsing" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    countries: number;
    churches: number;
    members: number;
    skipped: number;
    totalGiving: number;
  } | null>(null);

  async function handleFile(file: File) {
    setImportStage("parsing");
    setError(null);
    setSummary(null);
    try {
      const result = await parseZoneMemberSheet(file);
      if (result.rows.length === 0) {
        setError(result.skipped[0]?.reason ?? "No member rows found in that file.");
        setImportStage("error");
        return;
      }
      const churchCount = result.countries.reduce((sum, c) => sum + c.churches.length, 0);
      setWizard((w) => ({
        ...w,
        importFileName: file.name,
        countries: result.countries,
        importedMembers: result.rows.map((r) => ({
          countryName: r.countryName,
          churchName: r.churchName,
          member: r.member,
        })),
      }));
      setSummary({
        countries: result.countries.length,
        churches: churchCount,
        members: result.rows.length,
        skipped: result.skipped.length,
        totalGiving: result.totalGiving,
      });
      setImportStage("idle");
    } catch {
      setError("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv.");
      setImportStage("error");
    }
  }

  function clear() {
    setWizard((w) => ({ ...w, importFileName: null, importedMembers: [], churchMeta: {} }));
    setSummary(null);
    setError(null);
    setImportStage("idle");
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        One flat sheet with Country and Church/Chapter columns — this replaces what you entered in the previous
        step.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setImportStage("dragging");
        }}
        onDragLeave={() => setImportStage(importStage === "dragging" ? "idle" : importStage)}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
          importStage === "dragging" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {importStage === "parsing" ? (
          <p className="text-sm font-medium text-muted-foreground">Reading file…</p>
        ) : wizard.importFileName ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{wizard.importFileName}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> remove
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drag &amp; drop a spreadsheet here</p>
            <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls, .csv</p>
          </>
        )}
      </div>

      {summary && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            Ready to import {summary.members.toLocaleString()} members across {summary.countries} countries and{" "}
            {summary.churches} churches, with ${summary.totalGiving.toLocaleString()} in recorded giving.
            {summary.skipped > 0 && ` ${summary.skipped} row(s) were skipped (missing data or inactive).`} The
            previous step&apos;s country/church list has been replaced with what came from this file.
          </div>
        </div>
      )}
      {importStage === "error" && error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

type EditableGroup = ChapterGroup & { country: string; canonicalName: string; subZone: string };
type RosterStage = "idle" | "parsing" | "review" | "confirmed" | "error";

function RosterImportPanel({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [stage, setStage] = useState<RosterStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<RosterPerson[]>([]);
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [duplicatesMerged, setDuplicatesMerged] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [givingFileName, setGivingFileName] = useState<string | null>(null);
  const [givingMap, setGivingMap] = useState<Map<string, { givingTotal?: number; givingDate?: string }>>(new Map());
  const [confirmedSummary, setConfirmedSummary] = useState<{
    people: number;
    leaders: number;
    churches: number;
    countries: number;
    giving: number;
  } | null>(null);
  const rosterInputRef = useRef<HTMLInputElement>(null);
  const givingInputRef = useRef<HTMLInputElement>(null);

  async function handleRosterFile(file: File) {
    setStage("parsing");
    setError(null);
    try {
      const result = await parseLeadershipRoster(file);
      if (result.people.length === 0) {
        setError("No people found in that file — expected sheets with FIRSTNAME/SURNAME columns.");
        setStage("error");
        return;
      }
      setPeople(result.people);
      setGroups(
        result.chapterGroups.map((g) => ({
          ...g,
          country: g.suggestedCountry,
          canonicalName: g.suggestedName,
          subZone: g.suggestedSubZone,
        }))
      );
      setDuplicatesMerged(result.duplicatesMerged);
      setSkippedCount(result.skipped.length);
      setWizard((w) => ({ ...w, importFileName: file.name }));
      setStage("review");
    } catch {
      setError("Couldn't read that file. Make sure it's a valid .xlsx or .xls workbook.");
      setStage("error");
    }
  }

  async function handleGivingFile(file: File) {
    try {
      const result = await parseZoneMemberSheet(file);
      const map = new Map<string, { givingTotal?: number; givingDate?: string }>();
      for (const r of result.rows) {
        if (r.member.email) map.set(r.member.email.toLowerCase(), { givingTotal: r.member.givingTotal, givingDate: r.member.givingDate });
      }
      setGivingMap(map);
      setGivingFileName(file.name);
    } catch {
      setGivingFileName(null);
    }
  }

  function updateGroup(key: string, patch: Partial<Pick<EditableGroup, "country" | "canonicalName" | "subZone">>) {
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  const allCountriesFilled = groups.length > 0 && groups.every((g) => g.country.trim());

  function confirmImport() {
    const byKey = new Map(groups.map((g) => [g.key, g]));
    const countryOrder: string[] = [];
    const byCountry = new Map<string, Set<string>>();
    let matchedGiving = 0;
    let leaderCount = 0;
    const churchMeta: WizardState["churchMeta"] = {};

    const importedMembers: WizardState["importedMembers"] = people.map((p) => {
      const group = byKey.get(normalizeChapterKey(p.chapterRaw))!;
      const countryName = group.country.trim();
      const churchName = group.canonicalName.trim() || group.suggestedName;
      if (!byCountry.has(countryName)) {
        byCountry.set(countryName, new Set());
        countryOrder.push(countryName);
      }
      byCountry.get(countryName)!.add(churchName);
      churchMeta[`${countryName}::${churchName}`] = {
        subZoneName: group.subZone.trim() || undefined,
        isOffice: group.isOffice,
      };

      const giving = p.email ? givingMap.get(p.email) : undefined;
      if (giving?.givingTotal) matchedGiving++;
      if (p.position !== "member") leaderCount++;

      return {
        countryName,
        churchName,
        member: {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone,
          role: p.churchRole,
          givingTotal: giving?.givingTotal,
          givingDate: giving?.givingDate,
          title: p.title,
          kcHandle: p.kcHandle,
          profession: p.profession,
          spouseName: p.spouseName,
          birthday: p.birthday,
          weddingAnniversary: p.weddingAnniversary,
          position: p.position,
          portfolio: p.portfolio ?? undefined,
        },
      };
    });

    const countries: WizardCountry[] = countryOrder.map((name) => ({ name, churches: [...byCountry.get(name)!] }));

    setWizard((w) => ({ ...w, countries, importedMembers, churchMeta }));
    setConfirmedSummary({
      people: importedMembers.length,
      leaders: leaderCount,
      churches: new Set(importedMembers.map((m) => m.churchName)).size,
      countries: countries.length,
      giving: matchedGiving,
    });
    setStage("confirmed");
  }

  function startOver() {
    setStage("idle");
    setPeople([]);
    setGroups([]);
    setError(null);
    setConfirmedSummary(null);
    setGivingMap(new Map());
    setGivingFileName(null);
    setWizard((w) => ({ ...w, importFileName: null, importedMembers: [] }));
  }

  if (stage === "idle" || stage === "parsing" || stage === "error") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A multi-sheet workbook (one tab per sub-zone, plus leadership summary sheets). Each person&apos;s position
          (Governor, Deputy Governor, Secretary…) is read from the Designation column. Nobody gets a login
          automatically — you invite leaders when they need access.
        </p>
        <div
          onClick={() => rosterInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:bg-muted/50 p-10 text-center cursor-pointer transition-colors"
        >
          <input
            ref={rosterInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleRosterFile(e.target.files[0])}
          />
          {stage === "parsing" ? (
            <p className="text-sm font-medium text-muted-foreground">Reading workbook…</p>
          ) : (
            <>
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drag &amp; drop the roster workbook here</p>
              <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls</p>
            </>
          )}
        </div>
        {stage === "error" && error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  if (stage === "confirmed" && confirmedSummary) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div>
            Ready to import {confirmedSummary.people.toLocaleString()} people across {confirmedSummary.countries}{" "}
            countries and {confirmedSummary.churches} chapters. {confirmedSummary.leaders} hold a leadership
            position (recorded only — no logins are created).
            {confirmedSummary.giving > 0 && ` ${confirmedSummary.giving} matched giving data from the second file.`}
          </div>
        </div>
        <button type="button" onClick={startOver} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" /> start over
        </button>
      </div>
    );
  }

  // stage === "review"
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2.5 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <div>
          {people.length} people found across {groups.length} chapters ({wizard.importFileName}).{" "}
          {duplicatesMerged} duplicate rows merged across leadership/sub-zone sheets.
          {skippedCount > 0 && ` ${skippedCount} row(s) skipped (no chapter identified).`}
        </div>
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <p className="text-sm font-medium">Giving data (optional)</p>
        <p className="text-xs text-muted-foreground">
          Upload a flat member export with an Email and a giving-amount column — matched to this roster by email.
        </p>
        <div
          onClick={() => givingInputRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs cursor-pointer hover:bg-muted/50"
        >
          <input
            ref={givingInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleGivingFile(e.target.files[0])}
          />
          <UploadCloud className="h-3.5 w-3.5 text-muted-foreground" />
          {givingFileName ?? "Click to choose a file"}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Confirm each chapter&apos;s name, sub-zone and country</p>
        <p className="text-xs text-muted-foreground">
          Pre-filled where confident — review every row before importing (some chapter names collapsed from
          multiple spellings found in the file).
        </p>
        <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
          {groups.map((g) => (
            <div key={g.key} className="flex items-center gap-2 p-2">
              <div className="flex-1 min-w-0">
                <Input
                  value={g.canonicalName}
                  onChange={(e) => updateGroup(g.key, { canonicalName: e.target.value })}
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {g.memberCount} people
                  {g.variants.length > 1 ? ` · spelled as: ${g.variants.join(", ")}` : ""}
                </p>
              </div>
              <Input
                value={g.subZone}
                onChange={(e) => updateGroup(g.key, { subZone: e.target.value })}
                placeholder="Sub-zone"
                className="h-8 text-sm w-24 shrink-0"
              />
              <Input
                value={g.country}
                onChange={(e) => updateGroup(g.key, { country: e.target.value })}
                placeholder="Country"
                list="zone-countries"
                className="h-8 text-sm w-36 shrink-0"
              />
            </div>
          ))}
        </div>
      </div>

      {!allCountriesFilled && (
        <p className="text-xs text-amber-700">Assign a country to every chapter above to continue.</p>
      )}
      <div className="flex items-center gap-2">
        <Button type="button" onClick={confirmImport} disabled={!allCountriesFilled} size="sm">
          Confirm import
        </Button>
        <button type="button" onClick={startOver} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" /> start over
        </button>
      </div>
    </div>
  );
}

function StepReview({ wizard }: { wizard: WizardState }) {
  const countries = wizard.countries.filter((c) => c.name.trim());
  const totalChurches = countries.reduce((sum, c) => sum + c.churches.filter((n) => n.trim()).length, 0);
  const assistants = wizard.assistants.filter((a) => a.name.trim() && a.email.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Check everything before you finish.</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <SummaryStat label="Countries" value={countries.length} icon={Globe2} />
        <SummaryStat label="Churches" value={totalChurches} icon={ChurchIcon} />
        <SummaryStat label="Assistants" value={assistants.length} icon={Users} />
        <SummaryStat label="Members" value={wizard.importedMembers.length} icon={Users} />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Zone</p>
        <p className="text-sm text-muted-foreground">
          {wizard.zoneName} &middot; Super Admin: {wizard.adminName} ({wizard.adminEmail})
        </p>
      </div>

      {countries.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Structure</p>
          <div className="space-y-2">
            {countries.map((c) => (
              <div key={c.name} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.churches.filter((n) => n.trim()).join(", ") || "No churches added"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {assistants.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Assistants</p>
          <p className="text-sm text-muted-foreground">
            {assistants.map((a) => `${a.name} (${a.email})`).join(", ")}
          </p>
        </div>
      )}

      {wizard.importFileName && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Import</p>
          <p className="text-sm text-muted-foreground">
            {wizard.importFileName} &middot; {wizard.importedMembers.length.toLocaleString()} members ready to
            create
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border p-4">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <p className="text-xl font-semibold leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
