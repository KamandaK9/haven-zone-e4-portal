// Shared between server and client (dropdowns need CURRENCIES too) — no
// network access here. See currency-server.ts for live rate fetching.

// All amounts are stored in the database as USD (that's what the real
// imports/giving exports use) — currency is purely a display-time
// conversion, so historical figures never need to be rewritten when a
// zone changes its display currency.
export const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "ZAR", label: "South African Rand" },
  { code: "ZMW", label: "Zambian Kwacha" },
  { code: "BWP", label: "Botswana Pula" },
  { code: "NAD", label: "Namibian Dollar" },
  { code: "MZN", label: "Mozambican Metical" },
  { code: "SZL", label: "Eswatini Lilangeni" },
  { code: "MWK", label: "Malawian Kwacha" },
  { code: "GBP", label: "British Pound" },
  { code: "EUR", label: "Euro" },
  { code: "NGN", label: "Nigerian Naira" },
  { code: "KES", label: "Kenyan Shilling" },
  { code: "GHS", label: "Ghanaian Cedi" },
  { code: "UGX", label: "Ugandan Shilling" },
  { code: "TZS", label: "Tanzanian Shilling" },
  { code: "CAD", label: "Canadian Dollar" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export function isCurrencyCode(code: string): code is CurrencyCode {
  return CURRENCIES.some((c) => c.code === code);
}

// amountUsd is always the canonical stored value.
export function convertFromUsd(amountUsd: number, currency: CurrencyCode, rates: Record<string, number>): number {
  if (currency === "USD") return amountUsd;
  const rate = rates[currency];
  return rate ? amountUsd * rate : amountUsd; // rate fetch failed — show USD rather than a wrong number
}

export function formatMoney(amountUsd: number, currency: CurrencyCode, rates: Record<string, number>): string {
  const converted = convertFromUsd(amountUsd, currency, rates);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: converted >= 1000 ? 0 : 2,
    }).format(converted);
  } catch {
    return `${currency} ${converted.toLocaleString()}`;
  }
}

function currencySymbol(currency: CurrencyCode): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.filter((p) => p.type === "currency").map((p) => p.value).join("") || currency;
  } catch {
    return currency;
  }
}

// For chart axis ticks, where a full Intl.NumberFormat is too wide —
// "R15k" rather than "R15,000.00".
export function compactMoney(amountUsd: number, currency: CurrencyCode, rates: Record<string, number>): string {
  const converted = convertFromUsd(amountUsd, currency, rates);
  const symbol = currencySymbol(currency);
  const abs = Math.abs(converted);
  if (abs >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(1)}M`;
  if (abs >= 1000) return `${symbol}${(converted / 1000).toFixed(0)}k`;
  return `${symbol}${Math.round(converted)}`;
}
