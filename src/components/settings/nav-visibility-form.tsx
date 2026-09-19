"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { updateHiddenNavItems } from "@/lib/actions/settings";
import { NAV_ITEMS } from "@/lib/nav-items";

export function NavVisibilityForm({ initialHidden }: { initialHidden: string[] }) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hideableItems = NAV_ITEMS.filter((item) => item.hideable);

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    const result = await updateHiddenNavItems([...hidden]);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {hideableItems.map((item) => {
          const Icon = item.icon;
          const visible = !hidden.has(item.key);
          return (
            <label
              key={item.key}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent transition-colors"
            >
              <Checkbox checked={visible} onCheckedChange={() => toggle(item.key)} />
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium flex-1">{item.label}</span>
              <span className="text-xs text-muted-foreground">{visible ? "Shown" : "Hidden"}</span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save preferences"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}
