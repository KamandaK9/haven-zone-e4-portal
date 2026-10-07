import { tenant } from "@/tenant";

// What this deployment calls each level of its structure, for UI copy.
// Database names stay zone/sub_zone/church/cell/country whatever these say —
// only user-visible text reads from here. Lowercase forms are for mid-sentence.
const l = tenant.labels;
export const labels = {
  zone: l.zone ?? "Zone",
  zones: l.zonePlural ?? "Zones",
  country: l.country ?? "Country",
  countries: l.countryPlural ?? "Countries",
  location: l.location,
  locations: l.locationPlural,
  cell: l.cell,
  cells: l.cellPlural,
  subZone: l.group,
  subZones: l.groupPlural,
};

export const lower = (s: string) => s.toLowerCase();

// True when there's no point showing a country level (the whole deployment
// is one country), so screens go straight to the locations.
export const singleCountry = tenant.countries.length === 1;
