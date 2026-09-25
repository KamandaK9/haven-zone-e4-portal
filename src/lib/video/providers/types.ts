import "server-only";
import type { PlaybackSource, UploadTarget, VideoProviderId } from "../provider";

// A direct upload as the host reports it.
export type UploadState = {
  uploadId: string;
  status: "waiting" | "asset_created" | "failed";
  assetId?: string;
};

// The video the host made from an upload.
export type AssetState = {
  assetId: string;
  // Lets a lesson be matched before it has learned its asset id.
  uploadId?: string;
  status: "processing" | "ready" | "errored";
  playbackId?: string;
  durationSeconds?: number;
};

export type WebhookUpdate = { upload: UploadState } | { asset: AssetState };

// What a video host has to provide. One file per host in this folder,
// registered in ./index.ts.
export interface VideoProvider {
  id: VideoProviderId;
  // Human name, for settings/error messages.
  label: string;
  // All required env vars are set.
  isConfigured(): boolean;
  // Starts an upload the browser sends the file to directly.
  createUpload(input: { lessonId: string; corsOrigin: string }): Promise<{ uploadId: string; target: UploadTarget }>;
  getUpload(uploadId: string): Promise<UploadState>;
  getAsset(assetId: string): Promise<AssetState>;
  // Best-effort; must not throw.
  deleteAsset(assetId: string): Promise<void>;
  // Playback for one viewing (e.g. signed, short-lived URLs/tokens).
  playbackSource(playbackId: string): Promise<PlaybackSource>;
  // Whether webhooks can be verified (the secret is set).
  webhooksConfigured(): boolean;
  // Verifies and translates a webhook. Throws on a bad signature; null for
  // events that don't concern lesson videos.
  parseWebhook(body: string, headers: Headers): Promise<WebhookUpdate | null>;
}
