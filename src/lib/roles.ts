import { CAPABILITY_LABELS, canActOn, defaultCapabilities, positionDef, type Position } from "@/lib/access";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";
import type { Modules } from "@/lib/modules";
import type { RoleOption } from "@/components/members/role-card";

// What a role sees, in words, from its scope.
export function scopeWords(scope: string): string {
  const l = (s: string) => s.toLowerCase();
  switch (scope) {
    case "zone": return `all of ${tenant.name}`;
    case "sub_zone": return `their ${l(labels.subZone)}`;
    case "chapter": return `their ${l(labels.location)}`;
    case "cell": return `their ${l(labels.cells)}`;
    default: return "their own record";
  }
}

// Capabilities that belong to a feature that's switched off aren't worth
// listing.
const FEATURE_CAPS: Partial<Record<string, keyof Modules>> = {
  check_in: "attendance", view_attendance: "attendance", record_follow_up: "attendance", view_pastoral_notes: "attendance",
  manage_services: "attendance", manage_courses: "courses", teach_courses: "courses", send_messages: "messaging",
  approve_messages: "messaging", view_giving_totals: "giving", view_giving_individual: "giving", import_giving: "giving",
  manage_ledger: "ledger", manage_training: "training", send_newsletter: "newsletter", manage_events: "events",
  manage_records: "records", manage_livestreams: "livestreams",
};

export function roleOption(key: string, modules: Modules): RoleOption {
  const def = positionDef(key as Position);
  const caps = defaultCapabilities(key as Position, null).filter((c) => !FEATURE_CAPS[c] || modules[FEATURE_CAPS[c]!]);
  return {
    key,
    label: def?.label ?? key,
    description: def?.description,
    sees: scopeWords(def?.scope ?? "self"),
    can: def?.loginRole === "super_admin" ? ["Everything"] : caps.map((c) => CAPABILITY_LABELS[c]),
    cellRole: def?.scope === "cell",
  };
}

// The roles someone may give: those ranked below their own, most senior first.
export function assignableRoles(actor: Position, modules: Modules): RoleOption[] {
  return tenant.access.positions
    .filter((p) => canActOn(actor, p.key as Position))
    .sort((a, b) => a.rank - b.rank)
    .map((p) => roleOption(p.key, modules));
}
