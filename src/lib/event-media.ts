// Shared by the upload UI and the server actions that authorise it.

export const EVENT_MEDIA_BUCKET = "event-media";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function checkUpload(kind: "image" | "file", type: string, size: number): string | null {
  const allowed = kind === "image" ? IMAGE_TYPES : FILE_TYPES;
  if (!allowed.includes(type)) {
    return kind === "image" ? "Pictures must be JPG, PNG, WebP or GIF." : "Resources must be PDF, Word, PowerPoint or Excel files.";
  }
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (size > max) return `That file is too large (limit ${Math.round(max / 1024 / 1024)} MB).`;
  return null;
}

// YouTube/Vimeo links become an embedded player; anything else is shown as a link.
export function videoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") ?? /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(u.pathname)?.[1];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = /^\/(\d+)/.exec(u.pathname)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    // not a URL — caller validates separately
  }
  return null;
}
