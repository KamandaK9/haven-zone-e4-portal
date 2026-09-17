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
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StepProgress } from "@/components/setup/step-progress";
import { STEP_LABELS, type WizardState } from "@/components/setup/types";
import { useZone } from "@/lib/data/zone-context";
import type { ZoneData } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = STEP_LABELS.length;

const EMPTY_WIZARD: WizardState = {
  zoneName: "Haven Zone E4",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  countries: [{ name: "", churches: [""] }],
  assistants: [{ name: "", email: "" }],
  importFileName: null,
};

function buildWizardState(data: ZoneData): WizardState {
  if (!data.setupComplete) return EMPTY_WIZARD;
  const countries = data.countries.map((c) => ({
    name: c.name,
    churches: data.churches.filter((ch) => ch.countryId === c.id).map((ch) => ch.name),
  }));
  return {
    zoneName: data.zoneName,
    adminName: data.superAdmin?.name ?? "",
    adminEmail: data.superAdmin?.email ?? "",
    adminPhone: data.superAdmin?.phone ?? "",
    countries: countries.length ? countries : EMPTY_WIZARD.countries,
    assistants: data.assistants.length
      ? data.assistants.map((a) => ({ name: a.name, email: a.email }))
      : EMPTY_WIZARD.assistants,
    importFileName: null,
  };
}

export default function SetupPage() {
  const { data } = useZone();
  // Remounts (fresh lazy-init state) the moment real data becomes available
  // after hydration, so reopening from Settings prefills without an effect.
  return <SetupWizard key={data.setupComplete ? "existing" : "new"} initialData={data} />;
}

function SetupWizard({ initialData }: { initialData: ZoneData }) {
  const router = useRouter();
  const { completeSetup } = useZone();
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(() => buildWizardState(initialData));
  const [submitted, setSubmitted] = useState(false);
  const [importStage, setImportStage] = useState<"idle" | "dragging" | "picked">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function next() {
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handleSubmit() {
    const filteredCountries = wizard.countries.filter((c) => c.name.trim());
    const churchesByCountryIndex: Record<number, { name: string }[]> = {};
    filteredCountries.forEach((c, i) => {
      churchesByCountryIndex[i] = c.churches.filter((n) => n.trim()).map((n) => ({ name: n }));
    });

    completeSetup({
      zoneName: wizard.zoneName,
      superAdmin: { name: wizard.adminName, email: wizard.adminEmail, phone: wizard.adminPhone },
      countries: filteredCountries.map((c) => ({ name: c.name })),
      churchesByCountryIndex,
      assistants: wizard.assistants.filter((a) => a.name.trim() && a.email.trim()),
    });

    setSubmitted(true);
    setTimeout(() => router.push("/dashboard"), 1200);
  }

  const step1Valid = wizard.zoneName.trim() && wizard.adminName.trim() && wizard.adminEmail.trim();

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold">Zone set up</p>
            <p className="text-sm text-muted-foreground mt-1">Taking you to the dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <BrandMark size={32} />
          <div>
            <p className="font-semibold text-sm leading-tight">{wizard.zoneName || "Zone Setup"}</p>
            <p className="text-xs text-muted-foreground leading-tight">
              {initialData.setupComplete ? "Update your zone structure" : "Let's set up your zone"}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <StepProgress current={step} />

        <Card>
          <CardContent className="pt-6">
            {step === 1 && <StepZoneBasics wizard={wizard} setWizard={setWizard} />}
            {step === 2 && <StepCountries wizard={wizard} setWizard={setWizard} />}
            {step === 3 && <StepChurches wizard={wizard} setWizard={setWizard} />}
            {step === 4 && <StepAssistants wizard={wizard} setWizard={setWizard} />}
            {step === 5 && (
              <StepImport
                wizard={wizard}
                setWizard={setWizard}
                importStage={importStage}
                setImportStage={setImportStage}
                fileInputRef={fileInputRef}
              />
            )}
            {step === 6 && <StepReview wizard={wizard} />}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={back} disabled={step === 1} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {step < TOTAL_STEPS ? (
            <div className="flex items-center gap-2">
              {step === 5 && (
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
            <Button onClick={handleSubmit} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {initialData.setupComplete ? "Save changes" : "Complete setup"}
            </Button>
          )}
        </div>
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
      </div>
      <p className="text-xs text-muted-foreground">
        You&apos;ll be the Super Admin for {wizard.zoneName || "this zone"} with full access.
      </p>
    </div>
  );
}

function StepCountries({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  function updateName(i: number, name: string) {
    setWizard((w) => ({
      ...w,
      countries: w.countries.map((c, idx) => (idx === i ? { ...c, name } : c)),
    }));
  }
  function add() {
    setWizard((w) => ({ ...w, countries: [...w.countries, { name: "", churches: [""] }] }));
  }
  function remove(i: number) {
    setWizard((w) => ({ ...w, countries: w.countries.filter((_, idx) => idx !== i) }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Countries</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Which countries does {wizard.zoneName || "your zone"} cover?</p>
      </div>
      <div className="space-y-2.5">
        {wizard.countries.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="e.g. Zambia"
              value={c.name}
              onChange={(e) => updateName(i, e.target.value)}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(i)}
              disabled={wizard.countries.length === 1}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={add} className="gap-2">
        <Plus className="h-4 w-4" />
        Add country
      </Button>
    </div>
  );
}

function StepChurches({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const namedCountries = wizard.countries
    .map((c, i) => ({ ...c, index: i }))
    .filter((c) => c.name.trim());

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Churches</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Add the churches in each country.</p>
      </div>

      {namedCountries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
          Go back and add at least one country first.
        </p>
      ) : (
        <div className="space-y-5">
          {namedCountries.map((c) => (
            <div key={c.index} className="rounded-xl border p-4 space-y-3">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-primary" />
                {c.name}
              </p>
              <div className="space-y-2">
                {c.churches.map((church, churchIdx) => (
                  <div key={churchIdx} className="flex items-center gap-2">
                    <ChurchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="e.g. CE Lusaka Central"
                      value={church}
                      onChange={(e) => updateChurch(c.index, churchIdx, e.target.value)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChurch(c.index, churchIdx)}
                      disabled={c.churches.length === 1}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => addChurch(c.index)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add church
              </Button>
            </div>
          ))}
        </div>
      )}
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
        <h2 className="text-lg font-semibold">Assistants</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add admins who&apos;ll help manage day-to-day data entry across the zone.
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
  importStage,
  setImportStage,
  fileInputRef,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
  importStage: "idle" | "dragging" | "picked";
  setImportStage: (s: "idle" | "dragging" | "picked") => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  function pick(name: string) {
    setWizard((w) => ({ ...w, importFileName: name }));
    setImportStage("picked");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Already have a spreadsheet of members?</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Optional — drop it in now, or skip and add members one by one later.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setImportStage("dragging");
        }}
        onDragLeave={() => setImportStage(importStage === "dragging" ? "idle" : importStage)}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          pick(file?.name ?? "members.xlsx");
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
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0].name)}
        />
        {wizard.importFileName ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{wizard.importFileName}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setWizard((w) => ({ ...w, importFileName: null }));
                setImportStage("idle");
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
      <p className="text-xs text-muted-foreground">
        Prototype note: this queues the file for import but doesn&apos;t parse it yet — members from it won&apos;t
        appear until real import processing is wired up.
      </p>
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

      <div className="grid sm:grid-cols-3 gap-3">
        <SummaryStat label="Countries" value={countries.length} icon={Globe2} />
        <SummaryStat label="Churches" value={totalChurches} icon={ChurchIcon} />
        <SummaryStat label="Assistants" value={assistants.length} icon={Users} />
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
          <p className="text-sm text-muted-foreground">{wizard.importFileName} queued</p>
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
