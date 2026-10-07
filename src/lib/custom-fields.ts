import type { MemberFieldAccess, MemberFieldType, MemberFieldVisibility } from "@/lib/supabase/types";

// An organisation's own member fields ("Baptism date", "Department" …).
// Definitions live in member_fields; values, one row each, in
// member_field_values, where the database enforces each field's visibility.
// Pure — shared by Settings, imports and member pages.

export type MemberField = {
  id: string;
  key: string;
  label: string;
  type: MemberFieldType;
  options: string[];
  visibility: MemberFieldVisibility;
  memberAccess: MemberFieldAccess;
  sortOrder: number;
  archived: boolean;
};

export const FIELD_TYPES: { value: MemberFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice from a list" },
  { value: "yes_no", label: "Yes / no" },
];

export const FIELD_VISIBILITY: { value: MemberFieldVisibility; label: string; hint: string }[] = [
  { value: "leaders", label: "All leaders", hint: "Any leader who can see the member" },
  { value: "contact", label: "Leaders who see contact details", hint: "Like phone numbers and emails" },
  { value: "admins", label: "Admins only", hint: "Sensitive — only people who manage settings" },
];

export const FIELD_MEMBER_ACCESS: { value: MemberFieldAccess; label: string }[] = [
  { value: "hidden", label: "Members don't see it" },
  { value: "view", label: "Members see their own" },
  { value: "edit", label: "Members can edit their own" },
];

// "Baptism date" → "baptism_date", unique among `taken`.
export function fieldKeyFrom(label: string, taken: readonly string[]): string {
  const base =
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "f_$1")
      .slice(0, 40) || "field";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}

const YES = ["yes", "y", "true", "1", "x", "✓"];
const NO = ["no", "n", "false", "0"];

function isoDate(raw: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Turns typed or imported text into the stored form for the field's type.
// Blank → null (no value). Invalid → an error to show.
export function normaliseFieldValue(
  field: Pick<MemberField, "label" | "type" | "options">,
  raw: string | null | undefined
): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: true, value: null };
  switch (field.type) {
    case "text":
      return v.length > 2000 ? { ok: false, error: `${field.label} is too long.` } : { ok: true, value: v };
    case "number": {
      const n = Number(v.replace(/[\s,]/g, ""));
      return Number.isFinite(n) ? { ok: true, value: String(n) } : { ok: false, error: `${field.label} must be a number.` };
    }
    case "date": {
      const d = isoDate(v);
      return d ? { ok: true, value: d } : { ok: false, error: `${field.label} must be a date.` };
    }
    case "yes_no": {
      const k = v.toLowerCase();
      if (YES.includes(k)) return { ok: true, value: "yes" };
      if (NO.includes(k)) return { ok: true, value: "no" };
      return { ok: false, error: `${field.label} must be yes or no.` };
    }
    case "select": {
      const match = field.options.find((o) => o.toLowerCase() === v.toLowerCase());
      return match ? { ok: true, value: match } : { ok: false, error: `${field.label} must be one of: ${field.options.join(", ")}.` };
    }
  }
}

export function displayFieldValue(field: Pick<MemberField, "type">, value: string | undefined): string {
  if (!value) return "—";
  if (field.type === "yes_no") return value === "yes" ? "Yes" : "No";
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  return value;
}

// A first guess at a new field's type from a column's sample values.
export function guessFieldType(samples: readonly string[]): MemberFieldType {
  const vals = samples.map((s) => s.trim()).filter(Boolean);
  if (vals.length === 0) return "text";
  if (vals.every((v) => [...YES, ...NO].includes(v.toLowerCase()))) return "yes_no";
  if (vals.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) return "date";
  if (vals.every((v) => Number.isFinite(Number(v.replace(/[\s,]/g, ""))))) return "number";
  const distinct = new Set(vals.map((v) => v.toLowerCase()));
  if (vals.length >= 4 && distinct.size <= Math.min(6, vals.length / 2)) return "select";
  return "text";
}

// The distinct values of a column, for a new "choice" field's options.
export function distinctOptions(samples: readonly string[], max = 20): string[] {
  const seen = new Map<string, string>();
  for (const s of samples) {
    const v = s.trim();
    if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
  }
  return [...seen.values()].slice(0, max);
}

// What a leader may do with a field on members in their scope — mirrors
// can_access_member_field in the database, which is what actually enforces it.
export function leaderFieldAccess(
  field: Pick<MemberField, "visibility">,
  can: (capability: "view_members" | "view_contact_details" | "manage_members" | "manage_settings") => boolean
): { see: boolean; edit: boolean } {
  if (field.visibility === "admins") {
    const ok = can("manage_settings");
    return { see: ok, edit: ok };
  }
  const see = field.visibility === "contact" ? can("view_contact_details") : can("view_members");
  return { see, edit: see && can("manage_members") };
}
