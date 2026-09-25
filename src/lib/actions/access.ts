"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import {
  canActOn,
  isCapability,
  isPortfolio,
  isPosition,
  loginFor,
  type Capability,
  type Portfolio,
  type Position,
} from "@/lib/access";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

type UpdateAccessInput = {
  memberId: string;
  position: Position;
  portfolio: Portfolio | null;
  // Overrides on top of the position's defaults. Only meaningful for someone
  // who already has a login.
  granted: Capability[];
  revoked: Capability[];
};

async function requireAccessManager(): Promise<{ ok: true; profile: CurrentProfile } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  return { ok: true, profile };
}

export async function updateMemberAccess(input: UpdateAccessInput): Promise<ActionResult> {
  const auth = await requireAccessManager();
  if (!auth.ok) return auth;
  const { profile } = auth;

  if (!isPosition(input.position) || (input.portfolio !== null && !isPortfolio(input.portfolio))) {
    return { ok: false, error: "Unknown position." };
  }
  const granted = input.granted.filter(isCapability);
  const revoked = input.revoked.filter(isCapability);
  // Nobody can hand out more than they hold themselves.
  if (granted.some((c) => !can(profile, c))) {
    return { ok: false, error: "You can't grant a permission you don't hold yourself." };
  }

  // Service-role for the writes (profiles has no write policies) — every
  // check that matters is done here, before any of them.
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, zone_id, first_name, last_name, position, church_id, profile_id")
    .eq("id", input.memberId)
    .single();
  if (!member || member.zone_id !== profile.zoneId) return { ok: false, error: "Member not found." };
  if (member.profile_id === profile.userId) return { ok: false, error: "You can't change your own access." };

  const currentPosition = isPosition(member.position) ? member.position : "member";
  if (!canActOn(profile.position, currentPosition)) {
    return { ok: false, error: "You can only change access for people below your own position." };
  }
  if (input.position !== "member" && !canActOn(profile.position, input.position)) {
    return { ok: false, error: "You can't assign a position at or above your own." };
  }

  const portfolio = input.portfolio;
  const { error: memberError } = await admin
    .from("members")
    .update({ position: input.position, portfolio })
    .eq("id", member.id);
  if (memberError) return { ok: false, error: memberError.message };

  if (member.profile_id) {
    const { data: church } = await admin.from("churches").select("sub_zone_id").eq("id", member.church_id).single();
    const login = loginFor(input.position, portfolio, granted, revoked);
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: login.role,
        position: input.position,
        portfolio,
        scope: login.scope,
        sub_zone_id: church?.sub_zone_id ?? null,
        church_id: member.church_id,
        granted_caps: granted,
        revoked_caps: revoked,
        caps: login.caps,
      })
      .eq("id", member.profile_id);
    if (profileError) return { ok: false, error: profileError.message };
  }

  await logAudit(
    profile,
    "access.update",
    `Set ${member.first_name} ${member.last_name} to ${input.position.replace(/_/g, " ")}${portfolio ? ` (${portfolio})` : ""}` +
      (granted.length || revoked.length ? ` with ${granted.length} granted / ${revoked.length} revoked permissions` : "")
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

// Stored caps are a snapshot of position defaults + overrides. After the
// defaults in src/lib/access.ts change, this refreshes every login in the zone.
export async function recomputeZoneCapabilities(): Promise<ActionResult> {
  const auth = await requireAccessManager();
  if (!auth.ok) return auth;
  const { profile } = auth;

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, position, portfolio, granted_caps, revoked_caps")
    .eq("zone_id", profile.zoneId);
  if (error) return { ok: false, error: error.message };

  for (const p of profiles ?? []) {
    if (!isPosition(p.position)) continue;
    const login = loginFor(
      p.position,
      isPortfolio(p.portfolio) ? p.portfolio : null,
      p.granted_caps.filter(isCapability),
      p.revoked_caps.filter(isCapability)
    );
    const { error: updateError } = await admin
      .from("profiles")
      .update({ caps: login.caps, scope: login.scope, role: login.role })
      .eq("id", p.id);
    if (updateError) return { ok: false, error: updateError.message };
  }

  await logAudit(profile, "access.recompute", `Refreshed permissions for ${profiles?.length ?? 0} logins`);
  revalidatePath("/", "layout");
  return { ok: true };
}
