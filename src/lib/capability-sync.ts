import "server-only";
import { CAPABILITIES, effectiveCapabilities, isPortfolio, isPosition, type Capability } from "@/lib/access";
import { createAdminClient } from "@/lib/supabase/admin";

// New capabilities reach existing logins without SQL that names positions:
// zones.known_capabilities records what's been handed out; anything in the
// code's CAPABILITIES that isn't there yet is given to each login whose
// position (and portfolio) holds it by default, unless revoked for them.

// What a login gains from capabilities new to its organisation.
export function gainedCapabilities(
  login: { position: string; portfolio: string | null; caps: readonly string[]; revoked: readonly string[] },
  newCaps: readonly string[]
): Capability[] {
  if (!isPosition(login.position)) return [];
  const defaults = effectiveCapabilities(login.position, isPortfolio(login.portfolio) ? login.portfolio : null);
  return defaults.filter((c) => newCaps.includes(c) && !login.caps.includes(c) && !login.revoked.includes(c));
}

// Zones already in step with this build, so the check is once per server.
const inStep = new Set<string>();

// Brings a zone's logins up to date with any new capabilities. Returns the
// logins whose capabilities changed (id → new list). Never throws: a
// database without the column (migration not applied yet) is left alone.
export async function syncNewCapabilities(zoneId: string): Promise<Map<string, string[]>> {
  const changed = new Map<string, string[]>();
  if (inStep.has(zoneId)) return changed;
  try {
    const admin = createAdminClient();
    const { data: zone, error } = await admin.from("zones").select("known_capabilities").eq("id", zoneId).maybeSingle();
    if (error || !zone) return changed;
    const known = zone.known_capabilities;
    const newCaps = known ? CAPABILITIES.filter((c) => !known.includes(c)) : [];
    if (known && newCaps.length === 0) {
      inStep.add(zoneId);
      return changed;
    }
    if (newCaps.length > 0) {
      const { data: logins } = await admin.from("profiles").select("id, position, portfolio, caps, revoked_caps").eq("zone_id", zoneId);
      for (const l of logins ?? []) {
        const gained = gainedCapabilities(
          { position: l.position, portfolio: l.portfolio, caps: l.caps ?? [], revoked: l.revoked_caps ?? [] },
          newCaps
        );
        if (gained.length === 0) continue;
        const caps = [...(l.caps ?? []), ...gained];
        const { error: updateError } = await admin.from("profiles").update({ caps }).eq("id", l.id);
        if (!updateError) changed.set(l.id, caps);
      }
    }
    await admin.from("zones").update({ known_capabilities: [...CAPABILITIES] }).eq("id", zoneId);
    inStep.add(zoneId);
  } catch {
    // Try again on a later request.
  }
  return changed;
}
