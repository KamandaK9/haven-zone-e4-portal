import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Department = { id: string; name: string };

export async function getDepartments(): Promise<Department[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("id, name, sort_order").order("sort_order").order("name");
  return (data ?? []).map((d) => ({ id: d.id, name: d.name }));
}

// member id → their department ids, for everyone the viewer can see.
export async function getDepartmentMemberships(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase.from("member_departments").select("member_id, department_id").limit(50000);
  const out: Record<string, string[]> = {};
  for (const r of data ?? []) (out[r.member_id] ??= []).push(r.department_id);
  return out;
}
