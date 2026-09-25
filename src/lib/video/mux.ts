import "server-only";
import Mux from "@mux/mux-node";
import { tenant } from "@/tenant";

// Hosted lesson video via Mux. Everything is optional: with the MUX_* env
// vars unset, uploads are hidden and lessons use pasted links only.
//
// Videos are uploaded straight from the browser to Mux (a one-time signed
// upload URL, so files never pass through this server) and played back
// with a "signed" playback policy — a playback ID alone isn't enough to
// watch; every view needs a short-lived token minted below.

let client: Mux | null = null;

function mux(): Mux {
  // The SDK reads MUX_TOKEN_ID, MUX_TOKEN_SECRET, MUX_WEBHOOK_SECRET,
  // MUX_SIGNING_KEY and MUX_PRIVATE_KEY from the environment itself.
  client ??= new Mux();
  return client;
}

export function isHostedVideoEnabled(): boolean {
  const env = process.env;
  return !!(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET && env.MUX_SIGNING_KEY && env.MUX_PRIVATE_KEY);
}

// Languages Mux can auto-caption. Anything else (or null) skips captions.
const CAPTION_LANGUAGES = [
  "en", "es", "it", "pt", "de", "fr", "pl", "ru", "nl", "ca", "tr", "sv", "uk", "no", "fi", "sk", "el", "cs", "hr", "da", "ro", "bg", "auto",
] as const;
type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number];

function captionLanguage(): CaptionLanguage | null {
  const lang = tenant.captionLanguage;
  return lang && (CAPTION_LANGUAGES as readonly string[]).includes(lang) ? (lang as CaptionLanguage) : null;
}

export async function createDirectUpload(lessonId: string, corsOrigin: string): Promise<{ uploadId: string; url: string }> {
  const language = captionLanguage();
  const upload = await mux().video.uploads.create({
    cors_origin: corsOrigin,
    // An hour to finish uploading; long lessons on slow connections need it.
    timeout: 3600,
    new_asset_settings: {
      playback_policies: ["signed"],
      // Cheapest tier (and the one Mux's free plan covers); plenty for
      // talking-head and screen-recorded teaching.
      video_quality: "basic",
      // Lets the webhook find the lesson even before we've stored the asset id.
      passthrough: lessonId,
      ...(language && {
        inputs: [{ generated_subtitles: [{ language_code: language, name: "Captions (auto-generated)" }] }],
      }),
    },
  });
  if (!upload.url) throw new Error("Mux did not return an upload URL.");
  return { uploadId: upload.id, url: upload.url };
}

export async function getUpload(uploadId: string) {
  return mux().video.uploads.retrieve(uploadId);
}

export async function getAsset(assetId: string) {
  return mux().video.assets.retrieve(assetId);
}

// Best-effort: a lesson's old video is deleted when it's replaced or
// removed. Failing to delete only leaves an orphan in the Mux account.
export async function deleteAsset(assetId: string): Promise<void> {
  try {
    await mux().video.assets.delete(assetId);
  } catch {
    // already gone, or Mux unreachable
  }
}

export type PlaybackTokens = { playback?: string; thumbnail?: string; storyboard?: string };

// Short-lived tokens for one viewing session (video, poster image and the
// scrub-bar previews each need their own).
export async function signPlaybackTokens(playbackId: string): Promise<PlaybackTokens> {
  const tokens = await mux().jwt.signPlaybackId(playbackId, {
    type: ["video", "thumbnail", "storyboard"],
    expiration: "6h",
  });
  return {
    playback: tokens["playback-token"],
    thumbnail: tokens["thumbnail-token"],
    storyboard: tokens["storyboard-token"],
  };
}

export async function unwrapWebhook(body: string, headers: Headers) {
  return mux().webhooks.unwrap(body, headers);
}
