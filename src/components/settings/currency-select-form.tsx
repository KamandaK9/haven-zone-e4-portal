"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateDisplayCurrency } from "@/lib/actions/settings";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";

export function CurrencySelectForm({ initialCurrency }: { initialCurrency: string }) {
  const router = useRouter();
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(next: string) {
    setCurrency(next);
    setSaved(false);
    setSaving(true);
    const result = await updateDisplayCurrency(next);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Select value={currency} onValueChange={save} disabled={saving}>
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code as CurrencyCode}>
              {c.code} — {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saved && (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3.5 w-3.5" /> Saved
        </span>
      )}
    </div>
  );
}
