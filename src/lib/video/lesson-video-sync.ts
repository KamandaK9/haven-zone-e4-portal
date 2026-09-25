import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LessonVideoStatus } from "@/lib/supabase/types";
import { getAsset, getUpload } from "./mux";

// Moves a lesson's hosted video through uploading → processing → ready (or
// errored) as Mux reports progress. Called from the Mux webhook and, as a
// fallback when webhooks aren't set up (e.g. local dev), from the editor's
// "check status" and the learner page. Service-role client: webhooks have
// no user session.

type UploadState = { id: string; status: "waiting" | "asset_created" | "errored" | "cancelled" | "timed_out"; asset_id?: string };
type AssetState = {
  id: string;
  status: "preparing" | "ready" | "errored";
  upload_id?: string;
  duration?: number;
  playback_ids?: { id: string; policy: string }[];
};

function refreshLessonPages() {
  revalidatePath("/training", "layout");
  revalidatePath("/me/training", "layout");
}

export async function applyUploadState(upload: UploadState): Promise<void> {
  const admin = createAdminClient();
  const { data: lesson } = await admin
    .from("training_lessons")
    .select("id, video_status")
    .eq("video_upload_id", upload.id)
    .maybeSingle();
  if (!lesson || lesson.video_status !== "uploading") return;

  if (upload.status === "asset_created" && upload.asset_id) {
    await admin.from("training_lessons").update({ video_asset_id: upload.asset_id, video_status: "processing" }).eq("id", lesson.id);
  } else if (upload.status === "errored" || upload.status === "cancelled" || upload.status === "timed_out") {
    await admin.from("training_lessons").update({ video_status: "errored" }).eq("id", lesson.id);
  } else {
    return;
  }
  refreshLessonPages();
}

export async function applyAssetState(asset: AssetState): Promise<void> {
  const admin = createAdminClient();
  // Matched by upload id as well as asset id: the asset.ready webhook can
  // arrive before upload.asset_created has been processed. A lesson whose
  // video was replaced meanwhile has a different upload id, so a stale
  // asset never attaches to it.
  const filter = asset.upload_id ? `video_asset_id.eq.${asset.id},video_upload_id.eq.${asset.upload_id}` : `video_asset_id.eq.${asset.id}`;
  const { data: lesson } = await admin.from("training_lessons").select("id").or(filter).maybeSingle();
  if (!lesson) return;

  if (asset.status === "ready") {
    const playbackId = asset.playback_ids?.find((p) => p.policy === "signed")?.id;
    if (!playbackId) {
      await admin.from("training_lessons").update({ video_asset_id: asset.id, video_status: "errored" }).eq("id", lesson.id);
    } else {
      await admin
        .from("training_lessons")
        .update({
          video_asset_id: asset.id,
          video_playback_id: playbackId,
          duration_seconds: asset.duration ?? null,
          video_status: "ready",
        })
        .eq("id", lesson.id);
    }
  } else if (asset.status === "errored") {
    await admin.from("training_lessons").update({ video_asset_id: asset.id, video_status: "errored" }).eq("id", lesson.id);
  } else {
    await admin.from("training_lessons").update({ video_asset_id: asset.id, video_status: "processing" }).eq("id", lesson.id);
  }
  refreshLessonPages();
}

// Pulls the current state from Mux for one lesson that's still in flight.
export async function syncLessonVideo(lessonId: string): Promise<LessonVideoStatus | null> {
  const admin = createAdminClient();
  const read = async () =>
    (await admin.from("training_lessons").select("video_status, video_upload_id, video_asset_id").eq("id", lessonId).maybeSingle()).data;

  let lesson = await read();
  if (!lesson?.video_status) return null;

  if (lesson.video_status === "uploading" && lesson.video_upload_id) {
    await applyUploadState(await getUpload(lesson.video_upload_id));
    lesson = await read();
  }
  if (lesson?.video_status === "processing" && lesson.video_asset_id) {
    await applyAssetState(await getAsset(lesson.video_asset_id));
    lesson = await read();
  }
  return lesson?.video_status ?? null;
}
