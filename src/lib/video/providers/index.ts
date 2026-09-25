import "server-only";
import type { VideoProviderId } from "../provider";
import { muxProvider } from "./mux";
import type { VideoProvider } from "./types";

// Every video host Stratum can use. To add one: write an adapter next to
// mux.ts implementing VideoProvider, register it here, add its id to
// VIDEO_PROVIDER_IDS (../provider.ts), and extend the
// training_lessons.video_provider check constraint in a migration.
const PROVIDERS: Record<VideoProviderId, VideoProvider> = {
  mux: muxProvider,
};

export function getVideoProvider(id: VideoProviderId): VideoProvider {
  return PROVIDERS[id];
}

// The host new uploads go to on this deployment: VIDEO_PROVIDER if set (and
// configured), otherwise the first configured one. Null when none is set up
// — the upload/record options are hidden and lessons use links only.
// Existing videos always play from the provider stored on their lesson.
export function activeVideoProvider(): VideoProvider | null {
  const chosen = process.env.VIDEO_PROVIDER?.trim();
  if (chosen) {
    const provider = PROVIDERS[chosen as VideoProviderId];
    return provider?.isConfigured() ? provider : null;
  }
  return Object.values(PROVIDERS).find((p) => p.isConfigured()) ?? null;
}

export function isHostedVideoEnabled(): boolean {
  return activeVideoProvider() !== null;
}
