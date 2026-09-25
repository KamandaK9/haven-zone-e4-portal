import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PROGRAMS = [
  { name: "New Believers Class", icon: "Heart", points: 10 },
  { name: "Foundation School", icon: "BookOpen", points: 20 },
  { name: "Leadership Development", icon: "GraduationCap", points: 30 },
  { name: "Water Baptism", icon: "Droplet", points: 15 },
];

// The programs a new member is enrolled in: every program flagged
// assign_to_new_members. The four starter programs are created exactly once
// per zone (tracked by zones.default_programs_seeded), so an editor deleting
// or renaming one never causes it to reappear.
//
// Service-role on purpose: a Governor adding a member can't author programs
// themselves, but their new member should still get the standard set.
export async function getAutoAssignedProgramIds(zoneId: string): Promise<string[]> {
  const admin = createAdminClient();

  const { data: zone } = await admin.from("zones").select("default_programs_seeded").eq("id", zoneId).single();
  if (zone && !zone.default_programs_seeded) {
    // Claim the seed first so two concurrent requests can't both insert.
    const { data: claimed } = await admin
      .from("zones")
      .update({ default_programs_seeded: true })
      .eq("id", zoneId)
      .eq("default_programs_seeded", false)
      .select("id");
    if (claimed && claimed.length > 0) {
      await admin
        .from("training_programs")
        .insert(DEFAULT_PROGRAMS.map((p) => ({ ...p, zone_id: zoneId, assign_to_new_members: true })));
    }
  }

  const { data: programs } = await admin
    .from("training_programs")
    .select("id")
    .eq("zone_id", zoneId)
    .eq("assign_to_new_members", true);
  return (programs ?? []).map((p) => p.id);
}
