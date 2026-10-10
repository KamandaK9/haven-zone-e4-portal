"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateOrgSettings } from "@/lib/actions/org-settings";
import type { OrgSettings } from "@/lib/org-settings";

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

export function OrgSettingsForm({ settings, show }: { settings: OrgSettings; show: { records: boolean; attendance: boolean } }) {
  const router = useRouter();
  const [headline, setHeadline] = useState(settings.login.headline);
  const [blurb, setBlurb] = useState(settings.login.blurb);
  const [accounts, setAccounts] = useState<{ key?: string; label: string }[]>(settings.bankAccounts);
  const [meetingTypes, setMeetingTypes] = useState(settings.meetingTypes.join("\n"));
  const [departments, setDepartments] = useState(settings.departmentSuggestions.join("\n"));
  const [activeMin, setActiveMin] = useState(String(settings.attendance.activeMinSundays));
  const [alertAfter, setAlertAfter] = useState(String(settings.attendance.absenceAlertAfter));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMessage(null);
    start(async () => {
      const result = await updateOrgSettings({
        login: { headline, blurb },
        bankAccounts: accounts,
        meetingTypes: lines(meetingTypes),
        departmentSuggestions: lines(departments),
        attendance: { activeMinSundays: Number(activeMin), absenceAlertAfter: Number(alertAfter) },
      });
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sign-in page</CardTitle>
          <CardDescription>The welcome people see before they sign in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Headline</span>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Text underneath</span>
            <Textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={3} maxLength={400} />
          </label>
        </CardContent>
      </Card>

      {show.records && (
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>The bank accounts cheques and bank advices are filed against, and the meeting types for minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Bank accounts</p>
              {accounts.map((a, i) => (
                <div key={a.key ?? `new-${i}`} className="flex gap-2">
                  <Input
                    value={a.label}
                    onChange={(e) => setAccounts((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    aria-label="Account name"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove"
                    disabled={accounts.length === 1}
                    onClick={() => setAccounts((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setAccounts((list) => [...list, { label: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Add an account
              </Button>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Meeting types</span>
              <Textarea value={meetingTypes} onChange={(e) => setMeetingTypes(e.target.value)} rows={4} />
              <span className="text-xs text-muted-foreground">One per line. Suggestions only — any type can be typed in.</span>
            </label>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Department suggestions</CardTitle>
          <CardDescription>Offered when setting up departments.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={departments} onChange={(e) => setDepartments(e.target.value)} rows={4} aria-label="Department suggestions" />
          <p className="mt-1 text-xs text-muted-foreground">One per line.</p>
        </CardContent>
      </Card>

      {show.attendance && (
        <Card>
          <CardHeader>
            <CardTitle>Attendance rules</CardTitle>
            <CardDescription>When someone counts as active, and when they&apos;re flagged for follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Active: Sundays in the last 30 days</span>
              <Input type="number" min={1} max={12} value={activeMin} onChange={(e) => setActiveMin(e.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Follow up after missing (in a row)</span>
              <Input type="number" min={1} max={12} value={alertAfter} onChange={(e) => setAlertAfter(e.target.value)} />
            </label>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {message && <p className={message.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{message.text}</p>}
      </div>
    </div>
  );
}
