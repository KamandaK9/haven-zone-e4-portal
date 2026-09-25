import { IMAGE_TYPES } from "@/lib/event-media";

// Same signed-upload-URL pattern as event pictures, just its own bucket and
// a tighter size limit — see MAX_IMAGE_BYTES / IMAGE_TYPES for the shared
// image rules.
export const MEMBER_PHOTOS_BUCKET = "member-photos";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function checkPhotoUpload(type: string, size: number): string | null {
  if (!IMAGE_TYPES.includes(type)) return "Photos must be JPG, PNG or WebP.";
  if (size > MAX_PHOTO_BYTES) return `That photo is too large (limit ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB).`;
  return null;
}
