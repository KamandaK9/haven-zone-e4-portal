// Numbers missing from a run of cheques — a stub that was never recorded,
// or a cheque book page torn out. Only plain digit numbers take part
// ("000123"); anything else can't be sequenced. Zero-padding is kept so the
// result reads like the cheque book. Very large holes are summarised rather
// than listed.
export function chequeGaps(numbers: readonly string[], maxListed = 20): { missing: string[]; more: number } {
  const digits = numbers.map((n) => n.trim()).filter((n) => /^\d+$/.test(n));
  if (digits.length < 2) return { missing: [], more: 0 };

  const width = Math.max(...digits.map((n) => n.length));
  const have = new Set(digits.map((n) => Number(n)));
  const sorted = [...have].sort((a, b) => a - b);

  const missing: string[] = [];
  let more = 0;
  for (let i = 1; i < sorted.length; i++) {
    for (let n = sorted[i - 1] + 1; n < sorted[i]; n++) {
      if (missing.length < maxListed) missing.push(String(n).padStart(width, "0"));
      else more++;
    }
  }
  return { missing, more };
}

// The number after the highest one used, keeping its zero-padding — what the
// next stub in the book should say.
export function nextChequeNumber(numbers: readonly string[]): string {
  const digits = numbers.map((n) => n.trim()).filter((n) => /^\d+$/.test(n));
  if (digits.length === 0) return "";
  const width = Math.max(...digits.map((n) => n.length));
  const max = Math.max(...digits.map((n) => Number(n)));
  return String(max + 1).padStart(width, "0");
}
