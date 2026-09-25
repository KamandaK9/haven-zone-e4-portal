// Hosted lesson video is provider-agnostic (Stratum core): each deployment
// picks a host (VIDEO_PROVIDER), and everything else — uploading,
// recording, watch-to-complete, the database — talks to it through these
// shapes. Shared by server and browser code; the server-side interface an
// adapter implements is in ./providers/types.ts.

// Every host a lesson's video can live on. Stored on training_lessons
// .video_provider, so adding one also means extending that column's check
// constraint in a migration.
export const VIDEO_PROVIDER_IDS = ["mux"] as const;
export type VideoProviderId = (typeof VIDEO_PROVIDER_IDS)[number];

export function isVideoProviderId(value: unknown): value is VideoProviderId {
  return typeof value === "string" && (VIDEO_PROVIDER_IDS as readonly string[]).includes(value);
}

// Where and how the browser sends a video file. A new host with a
// different upload protocol (e.g. tus) adds a variant here and a branch in
// the lesson editor's uploader.
export type UploadTarget = {
  // Resumable chunked PUTs to a one-time URL (Mux direct uploads, via UpChunk).
  protocol: "chunked-put";
  url: string;
};

// What the member's player needs to play one lesson video. Short-lived:
// minted per page view.
export type PlaybackSource = {
  kind: "mux";
  playbackId: string;
  tokens: { playback?: string; thumbnail?: string; storyboard?: string };
};
