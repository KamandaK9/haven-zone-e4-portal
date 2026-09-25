import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LessonVideoStatus } from "@/lib/supabase/types";
import { isVideoProviderId, type VideoProviderId } from "./provider";
import { getVideoProvider } from "./providers";
import type { AssetState, UploadState } from "./providers/types";

// Moves a lesson's hosted video through uploading → processing → ready (or
// errored) as its host reports progress. Called from the provider's
// webhook and, as a fallback when webhooks aren't set up (e.g. local dev),
// from the editor's "check status". Service-role client: webhooks have no
// user session.

function refreshLessonPages() {
  revalidatePath("/training", "layout");
  revalidatePath("/me/training", "layout");
}

export async function applyUploadState(provider: VideoProviderId, upload: UploadState): Promise<void> {
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("training_lessons")
    .select("id, video_status")
    .eq("video_provider", provider)
    .eq("video_upload_id", upload.uploadId)
    .maybeSingle();
  if (!lesson || lesson.video_status !== "uploading") return;

  if (upload.status === "asset_created" && upload.assetId) {
    await admin.from("training_lessons").update({ video_asset_id: upload.assetId, video_status: "processing" }).eq("id", lesson.id);
  } else if (upload.status === "failed") {
    await admin.from("training_lessons").update({ video_status: "errored" }).eq("id", lesson.id);
  } else {
    return;
  }
  refreshLessonPages();
}

export async function applyAssetState(provider: VideoProviderId, asset: AssetState): Promise<void> {
  const admin = createAdminClient();
  // Matched by upload id as well as asset id: the "asset ready" event can
  // arrive before "upload finished" has been processed. A lesson whose
  // video was replaced meanwhile has a different upload id, so a stale
  // asset never attaches to it.
  let query = admin.from("training_lessons").select("id").eq("video_provider", provider);
  query = asset.uploadId
    ? query.or(`video_asset_id.eq.${asset.assetId},video_upload_id.eq.${asset.uploadId}`)
    : query.eq("video_asset_id", asset.assetId);
  const { data: lesson } = await query.maybeSingle();
  if (!lesson) return;

  if (asset.status === "ready" && asset.playbackId) {
    await admin
      .from("training_lessons")
      .update({
        video_asset_id: asset.assetId,
        video_playback_id: asset.playbackId,
        duration_seconds: asset.durationSeconds ?? null,
        video_status: "ready",
      })
      .eq("id", lesson.id);
  } else if (asset.status === "processing") {
    await admin.from("training_lessons").update({ video_asset_id: asset.assetId, video_status: "processing" }).eq("id", lesson.id);
  } else {
    // errored, or "ready" without anything playable
    await admin.from("training_lessons").update({ video_asset_id: asset.assetId, video_status: "errored" }).eq("id", lesson.id);
  }
  refreshLessonPages();
}

// Pulls the current state from the host for one lesson that's still in flight.
export async function syncLessonVideo(lessonId: string): Promise<LessonVideoStatus | null> {
  const admin = createAdminClient();
  const read = async () =>
    (
      await admin
        .from("training_lessons")
        .select("video_provider, video_status, video_upload_id, video_asset_id")
        .eq("id", lessonId)
        .maybeSingle()
    ).data;

  let lesson = await read();
  if (!lesson?.video_status || !isVideoProviderId(lesson.video_provider)) return null;
  const providerId = lesson.video_provider;
  const provider = getVideoProvider(providerId);

  if (lesson.video_status === "uploading" && lesson.video_upload_id) {
    await applyUploadState(providerId, await provider.getUpload(lesson.video_upload_id));
    lesson = await read();
  }
  if (lesson?.video_status === "processing" && lesson.video_asset_id) {
    await applyAssetState(providerId, await provider.getAsset(lesson.video_asset_id));
    lesson = await read();
  }
  return lesson?.video_status ?? null;
}
