import { tenant } from "@/tenant";

// Flags for countries outside the tenant's own list, so an imported
// spreadsheet that mentions one still gets a sensible flag instead of a
// blank one.
const OTHER_FLAGS: Record<string, string> = {
  nigeria: "🇳🇬",
  ghana: "🇬🇭",
  kenya: "🇰🇪",
  uganda: "🇺🇬",
  tanzania: "🇹🇿",
  "united kingdom": "🇬🇧",
  "united states": "🇺🇸",
  canada: "🇨🇦",
  swaziland: "🇸🇿", // Eswatini's former name — still common in older sheets
};

export function flagForCountry(name: string): string {
  const key = name.trim().toLowerCase();
  return tenant.countries.find((c) => c.name.toLowerCase() === key)?.flag ?? OTHER_FLAGS[key] ?? "🏳️";
}
