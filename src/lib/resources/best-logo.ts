// Only the best logo is ever offered for use: a vector original if there is
// one (it scales to any size), otherwise the largest image; the newest wins
// a tie. Everything else is kept but hidden from download.

export type LogoFile = { id: string; mime: string; fileName: string; width?: number | null; height?: number | null; createdAt: string };

const VECTOR = /svg|pdf|postscript|illustrator|\.(svg|pdf|eps|ai)$/i;

export const isVector = (f: Pick<LogoFile, "mime" | "fileName">) => VECTOR.test(f.mime) || VECTOR.test(f.fileName);

// Long side below this is called out as too small for print.
export const MIN_LOGO_PIXELS = 1000;

export function isLowRes(f: LogoFile): boolean {
  return !isVector(f) && Math.max(f.width ?? 0, f.height ?? 0) < MIN_LOGO_PIXELS;
}

function score(f: LogoFile): number {
  if (isVector(f)) return Number.MAX_SAFE_INTEGER;
  return (f.width ?? 0) * (f.height ?? 0);
}

export function bestLogo<T extends LogoFile>(files: T[]): T | undefined {
  return [...files].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt))[0];
}
