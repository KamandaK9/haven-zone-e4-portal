// The nine countries The Haven Zone E4 covers, in the order they're listed
// on the setup wizard.
export const ZONE_COUNTRIES = [
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Botswana", flag: "🇧🇼" },
  { name: "Zimbabwe", flag: "🇿🇼" },
  { name: "Namibia", flag: "🇳🇦" },
  { name: "Zambia", flag: "🇿🇲" },
  { name: "Malawi", flag: "🇲🇼" },
  { name: "Eswatini", flag: "🇸🇿" },
  { name: "Mozambique", flag: "🇲🇿" },
  { name: "Angola", flag: "🇦🇴" },
] as const;

// Flags for countries outside the zone, so an imported spreadsheet that
// mentions one still gets a sensible flag instead of a blank one.
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
  return ZONE_COUNTRIES.find((c) => c.name.toLowerCase() === key)?.flag ?? OTHER_FLAGS[key] ?? "🏳️";
}
