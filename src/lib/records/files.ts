// Shared by the upload UI and the server actions that authorise uploads.

export const RECORDS_BUCKET = "chapter-records";
export const MAX_RECORD_FILE_BYTES = 25 * 1024 * 1024;

// Scans and photos of paperwork, plus the office formats letters come in.
// Keep in step with the bucket's allowed_mime_types in the migration.
export const RECORD_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const RECORD_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx";

export function checkRecordFile(type: string, size: number): string | null {
  if (!RECORD_FILE_TYPES.includes(type)) return "Attach a PDF, a photo (JPG, PNG, HEIC) or a Word/Excel file.";
  if (size > MAX_RECORD_FILE_BYTES) return `That file is too large (limit ${MAX_RECORD_FILE_BYTES / 1024 / 1024} MB).`;
  if (size === 0) return "That file is empty.";
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
