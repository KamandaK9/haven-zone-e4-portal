import "server-only";
import { isCurrencyCode, type CurrencyCode } from "./currency";

const DEFAULT_CURRENCY: CurrencyCode = "USD";

// exchangerate-api.com's free tier (no key) — refreshed daily, and one of
// the few free providers that covers Southern/East African currencies
// (ZMW, BWP, NAD, MZN, SZL, MWK, ...) rather than just G20 pairs.
async function fetchRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = (await res.json()) as { result: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) return {};
    return data.rates;
  } catch {
    return {}; // network hiccup — callers fall back to USD, never throw into a page render
  }
}

export async function getDisplayCurrency(zoneCurrency: string): Promise<{
  currency: CurrencyCode;
  rates: Record<string, number>;
}> {
  const currency = isCurrencyCode(zoneCurrency) ? zoneCurrency : DEFAULT_CURRENCY;
  const rates = currency === "USD" ? {} : await fetchRates();
  return { currency, rates };
}
