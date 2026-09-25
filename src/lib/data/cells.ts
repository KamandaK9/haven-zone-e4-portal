import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Cell } from "./types";

// A chapter's cells, as far as the viewer's RLS allows. `available` is false
// when the cells table doesn't exist yet (migration not applied), so the page
// can say so instead of showing an empty directory.
export async function getChapterCells(churchId: string): Promise<{ cells: Cell[]; available: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cells").select("*").eq("church_id", churchId);
  if (error) return { cells: [], available: false };
  return {
    available: true,
    cells: (data ?? []).map((c) => ({
      id: c.id,
      churchId: c.church_id,
      parentId: c.parent_id ?? undefined,
      name: c.name,
      leaderMemberId: c.leader_member_id ?? undefined,
      meetingDay: c.meeting_day ?? undefined,
      meetingPlace: c.meeting_place ?? undefined,
    })),
  };
}
