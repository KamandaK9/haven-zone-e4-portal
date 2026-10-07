import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECK_IN_SCREEN_BUCKET, resolveCheckInScreen, type CheckInScreen } from "@/lib/check-in/screen";

export async function getCheckInScreen(zoneId: string): Promise<CheckInScreen & { saved: { title: string; tagline: string } }> {
  const supabase = await createClient();
  const { data } = await supabase.from("check_in_screen").select("title, tagline, background_path, updated_at").eq("zone_id", zoneId).maybeSingle();
  // ?v= changes when the image does, so a cached copy is never stale.
  const backgroundUrl = data?.background_path
    ? `${supabase.storage.from(CHECK_IN_SCREEN_BUCKET).getPublicUrl(data.background_path).data.publicUrl}?v=${encodeURIComponent(data.updated_at)}`
    : undefined;
  return { ...resolveCheckInScreen(data, backgroundUrl), saved: { title: data?.title ?? "", tagline: data?.tagline ?? "" } };
}

// The same look for the public QR page, which has no signed-in user: read
// with the server's own client for the link's zone. Nothing personal.
export async function getCheckInScreenForZone(zoneId: string): Promise<CheckInScreen> {
  const admin = createAdminClient();
  const { data } = await admin.from("check_in_screen").select("title, tagline, background_path, updated_at").eq("zone_id", zoneId).maybeSingle();
  const backgroundUrl = data?.background_path
    ? `${admin.storage.from(CHECK_IN_SCREEN_BUCKET).getPublicUrl(data.background_path).data.publicUrl}?v=${encodeURIComponent(data.updated_at)}`
    : undefined;
  return resolveCheckInScreen(data, backgroundUrl);
}
