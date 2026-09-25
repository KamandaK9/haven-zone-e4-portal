import "server-only";
import Mux from "@mux/mux-node";
import { tenant } from "@/tenant";
import type { AssetState, UploadState, VideoProvider } from "./types";

// Mux (mux.com). Videos are uploaded straight from the browser (a one-time
// signed upload URL, so files never pass through this server) and played
// with a "signed" playback policy — a playback ID alone isn't enough to
// watch; every view needs short-lived tokens minted here.
//
// Env: MUX_TOKEN_ID, MUX_TOKEN_SECRET (API access token, Video read+write),
// MUX_SIGNING_KEY, MUX_PRIVATE_KEY (URL signing key), MUX_WEBHOOK_SECRET.
// The SDK reads them itself.

let client: Mux | null = null;
function mux(): Mux {
  client ??= new Mux();
  return client;
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

function toUploadState(u: { id: string; status: string; asset_id?: string }): UploadState {
  const status = u.status === "asset_created" ? "asset_created" : u.status === "waiting" ? "waiting" : "failed";
  return { uploadId: u.id, status, assetId: u.asset_id };
}

function toAssetState(a: {
  id: string;
  status: string;
  upload_id?: string;
  duration?: number;
  playback_ids?: { id: string; policy: string }[];
}): AssetState {
  const status = a.status === "ready" ? "ready" : a.status === "errored" ? "errored" : "processing";
  return {
    assetId: a.id,
    uploadId: a.upload_id,
    status,
    playbackId: a.playback_ids?.find((p) => p.policy === "signed")?.id,
    durationSeconds: a.duration,
  };
}

export const muxProvider: VideoProvider = {
  id: "mux",
  label: "Mux",

  isConfigured() {
    const env = process.env;
    return !!(env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET && env.MUX_SIGNING_KEY && env.MUX_PRIVATE_KEY);
  },

  async createUpload({ lessonId, corsOrigin }) {
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
        passthrough: lessonId,
        ...(language && {
          inputs: [{ generated_subtitles: [{ language_code: language, name: "Captions (auto-generated)" }] }],
        }),
      },
    });
    if (!upload.url) throw new Error("Mux did not return an upload URL.");
    return { uploadId: upload.id, target: { protocol: "chunked-put", url: upload.url } };
  },

  async getUpload(uploadId) {
    return toUploadState(await mux().video.uploads.retrieve(uploadId));
  },

  async getAsset(assetId) {
    return toAssetState(await mux().video.assets.retrieve(assetId));
  },

  async deleteAsset(assetId) {
    try {
      await mux().video.assets.delete(assetId);
    } catch {
      // already gone, or Mux unreachable — leaves an orphan at worst
    }
  },

  async playbackSource(playbackId) {
    // Video, poster image and scrub-bar previews each need their own token.
    const tokens = await mux().jwt.signPlaybackId(playbackId, {
      type: ["video", "thumbnail", "storyboard"],
      expiration: "6h",
    });
    return {
      kind: "mux",
      playbackId,
      tokens: {
        playback: tokens["playback-token"],
        thumbnail: tokens["thumbnail-token"],
        storyboard: tokens["storyboard-token"],
      },
    };
  },

  webhooksConfigured() {
    return !!process.env.MUX_WEBHOOK_SECRET;
  },

  async parseWebhook(body, headers) {
    // Verifies the mux-signature header against MUX_WEBHOOK_SECRET.
    const event = await mux().webhooks.unwrap(body, headers);
    switch (event.type) {
      case "video.upload.asset_created":
      case "video.upload.errored":
      case "video.upload.cancelled":
        return { upload: toUploadState(event.data) };
      case "video.asset.ready":
      case "video.asset.errored":
        return { asset: toAssetState(event.data) };
      default:
        return null;
    }
  },
};
