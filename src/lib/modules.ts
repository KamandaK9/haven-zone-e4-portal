import { tenant } from "@/tenant";
import type { ModuleKey } from "@/lib/tenant";

// Every optional feature Stratum offers, for Settings → Features. Whether a
// deployment's plan includes one is tenant.modules; whether it's switched on
// is that, minus what the organisation has turned off (zones.disabled_modules).

export type Modules = Record<ModuleKey, boolean>;

export const FEATURE_CATALOGUE: readonly { key: ModuleKey; name: string; description: string; comingSoon?: boolean }[] = [
  { key: "attendance", name: "Attendance & check-in", description: "Services, check-in at the door (volunteer, self check-in tablet or QR code), absence alerts and follow-ups." },
  { key: "courses", name: tenant.course?.name ?? "Courses", description: "Class groups with a teacher and a register; completion after a set number of classes." },
  { key: "resources", name: "Resources", description: "Logos, brand assets and press releases for leaders to download, with logo guidelines." },
  { key: "messaging", name: "Messaging", description: "SMS and email to members, cells and groups, and approved birthday messages.", comingSoon: true },
  { key: "giving", name: "Giving", description: "Contributions per member and location, giving trends and leaderboards." },
  { key: "ledger", name: "Ledger", description: "Income and expenses, imports and reconciliations." },
  { key: "records", name: "Records", description: "Minutes, correspondence, bank advices and cheques, with their paperwork." },
  { key: "training", name: "Training", description: "Self-paced video lessons and quizzes, with points and levels." },
  { key: "livestreams", name: "Live", description: "Livestreamed meetings with chat, and recordings." },
  { key: "events", name: "Events", description: "Pages for the annual flagship events, with photos and videos." },
  { key: "handbook", name: "Handbook", description: "The organisation's operating manual, searchable." },
  { key: "newsletter", name: "Newsletter", description: "Email broadcasts to members." },
];

export const isIncluded = (key: ModuleKey): boolean => !!tenant.modules[key];

export function effectiveModules(disabled: readonly string[]): Modules {
  const out = {} as Modules;
  for (const key of Object.keys(tenant.modules) as ModuleKey[]) out[key] = isIncluded(key) && !disabled.includes(key);
  for (const f of FEATURE_CATALOGUE) out[f.key] = isIncluded(f.key) && !disabled.includes(f.key);
  return out;
}
