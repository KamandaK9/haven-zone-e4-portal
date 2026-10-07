#!/usr/bin/env node
// Sets up a new client portal on Stratum.
//
//   npm run new-client -- --dir ../acme-portal                 (asks questions)
//   npm run new-client -- --dir ../acme-portal --config acme.json --yes
//
// It clones this Stratum checkout into --dir, keeps Stratum as the `upstream`
// remote (so the client can `git merge upstream/main` for updates), writes the
// client's tenant (src/tenant/), theme, logo, lint names, legal documents,
// package/Supabase names and a .env.local with a fresh SETUP_KEY, commits it,
// and optionally creates the client's GitHub repo and runs the checks.
// Answers are saved to stratum.client.json in the new repo, so the setup can
// be repeated or reviewed. Node built-ins only — runs before `npm ci`.

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const STRATUM = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Arguments ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
if (flag("help") || !option("dir")) {
  console.log(`Usage: npm run new-client -- --dir <path> [--config answers.json] [--yes] [--install] [--github owner/name]

  --dir       Where to create the client's repo (must not exist yet).
  --config    JSON answers (see stratum.client.example.json); asks for anything missing.
  --yes       Don't ask — use the config and defaults.
  --install   Run npm ci, then typecheck, lint and tests in the new repo.
  --github    Create a private GitHub repo (via gh) and push to it.`);
  process.exit(option("dir") ? 0 : 1);
}
const target = resolve(option("dir"));
if (existsSync(target)) fail(`${target} already exists — pick a new folder.`);
const given = option("config") ? JSON.parse(readFileSync(resolve(option("config")), "utf8")) : {};
const auto = flag("yes");

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}
function run(cmd, args, cwd, quiet = false) {
  return execFileSync(cmd, args, { cwd, stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
}

// ── Questions ─────────────────────────────────────────────────────────────
const rl = auto ? null : createInterface({ input: process.stdin, output: process.stdout });
async function ask(path, question, fallback) {
  const existing = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), given);
  if (existing !== undefined) return existing;
  if (auto) return fallback;
  const answer = (await rl.question(`${question}${fallback !== undefined && fallback !== "" ? ` [${fallback}]` : ""}: `)).trim();
  return answer || fallback;
}
const yes = async (path, question, fallback) => {
  const v = await ask(path, `${question} (y/n)`, fallback ? "y" : "n");
  return v === true || (typeof v === "string" && /^y/i.test(v));
};
const list = (v) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((s) => String(s).trim()).filter(Boolean);
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-");
const plural = (s) => (/(s|x|ch|sh)$/i.test(s) ? `${s}es` : /[^aeiou]y$/i.test(s) ? `${s.slice(0, -1)}ies` : `${s}s`);

console.log("\nStratum — new client setup\n");
const name = await ask("name", "Organisation name as people say it (e.g. Grace Church)", "");
if (!name) fail("An organisation name is needed.");
const slug = slugify(await ask("slug", "Short id for the repo and Supabase project", slugify(name)));
const portalName = await ask("portalName", "Portal name (login page and browser tab)", `${name} Portal`);
const description = await ask("description", "One-line description", `Member management and analytics for ${name}`);
const defaultOrgName = await ask("defaultOrgName", "Organisation name pre-filled on the setup wizard", name);
const emailDomain = await ask("emailDomain", "Their email domain (for placeholders)", `${slug.replace(/-/g, "")}.org`);
const adminNameExample = await ask("adminNameExample", "Example name for the first admin", "e.g. Pastor Jane Doe");
const currencies = [...readFileSync(join(STRATUM, "src/lib/currency.ts"), "utf8").matchAll(/code: "([A-Z]{3})"/g)].map((m) => m[1]);
const currency = String(await ask("currency", `Default display currency (${currencies.join(", ")})`, "USD")).toUpperCase();
if (!currencies.includes(currency)) fail(`Currency must be one of ${currencies.join(", ")}.`);
const timezone = await ask("timezone", "Time zone (IANA)", "Africa/Johannesburg");
try {
  new Intl.DateTimeFormat("en", { timeZone: timezone });
} catch {
  fail(`"${timezone}" isn't a time zone name (e.g. Africa/Johannesburg).`);
}
const brandColor = String(await ask("brandColor", "Brand colour (hex)", "#4f46e5"));
if (!/^#[0-9a-f]{6}$/i.test(brandColor)) fail("Brand colour must be a hex colour like #4f46e5.");
const logoPath = await ask("logo", "Path to a logo image (PNG or SVG; blank = initials)", "");
const countryCodes = list(await ask("countries", "Countries, as ISO codes (e.g. ZA,BW,ZW)", "ZA")).map((c) => c.toUpperCase());

const structure = await ask("structurePreset", "Structure: 1 = church network (zone → sub-zones → chapters), 2 = single church", "1");
const preset = /^(2|single)/.test(String(structure)) ? "single-church" : "church-network";
const isNetwork = preset === "church-network";
const groupLabel = await ask("labels.group", "Name for the level above chapters/branches", isNetwork ? "Sub-zone" : "Region");
const locationLabel = await ask("labels.location", "Name for a chapter/branch", isNetwork ? "Chapter" : "Branch");
const cellLabel = await ask("labels.cell", "Name for the smallest group", "Cell");
const cellUpper = await ask("labels.cellGroup", `Name for a group of ${plural(cellLabel).toLowerCase()}`, isNetwork ? "Senior cell" : "Group");

const moduleKeys = ["giving", "ledger", "livestreams", "records", "training", "events", "handbook", "newsletter"];
const modules = {};
for (const key of moduleKeys) modules[key] = await yes(`modules.${key}`, `Turn on ${key}?`, key !== "handbook");
const eventSeries = list(await ask("eventSeries", "Yearly flagship events, comma-separated (blank = none)", isNetwork ? "Annual Conference" : ""));
const bankAccounts = list(await ask("bankAccounts", "Bank accounts a branch operates, comma-separated", "Operating Account"));
const meetingTypes = list(await ask("meetingTypes", "Meeting types for minutes, comma-separated", "Leadership meeting, Branch meeting, Finance committee"));

console.log("\nPrivacy (POPIA) — leave blank to fill in later; blanks become [placeholders] flagged in Settings.");
const legalName = await ask("legal.organisationName", "Registered/legal name", "");
const address = await ask("legal.physicalAddress", "Physical address", "");
const ioName = await ask("legal.informationOfficer.name", "Information Officer's name", "");
const ioEmail = await ask("legal.informationOfficer.email", "Information Officer's email", "");
const ioPhone = await ask("legal.informationOfficer.phone", "Information Officer's phone (optional)", "");
const religiousBody = await yes("legal.religiousBody", "Is it a religious organisation?", true);
const supabaseRegion = await ask("legal.supabaseRegion", "Supabase project region (e.g. eu-west-1)", "");
const hostingRegion = await ask("legal.hostingRegion", "Hosting region (e.g. Vercel, Frankfurt)", "");
const siteUrl = await ask("siteUrl", "The portal's URL once deployed (optional)", "");
rl?.close();

// ── Colours ───────────────────────────────────────────────────────────────
// sRGB hex → OKLCH hue, so the generated theme keeps the brand's hue.
function hexToOklch(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
const mix = (hex, toward, t) =>
  "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t) + toward * t).toString(16).padStart(2, "0")).join("");
const { h, c } = hexToOklch(brandColor);
const hue = Math.round(h);

// ── Clone and wire up git ────────────────────────────────────────────────
console.log(`\nCloning Stratum into ${target} …`);
run("git", ["clone", "--quiet", STRATUM, target]);
let upstreamUrl = STRATUM;
try {
  upstreamUrl = run("git", ["remote", "get-url", "origin"], STRATUM, true).trim();
} catch {
  // a Stratum checkout without a remote: point upstream at the local folder
}
run("git", ["remote", "remove", "origin"], target);
run("git", ["remote", "add", "upstream", upstreamUrl], target);
run("git", ["config", "merge.ours.driver", "true"], target);
const at = (p) => join(target, p);

// ── Theme: the example theme with the brand's hue ────────────────────────
const exampleTheme = readFileSync(at("src/tenant/theme.css"), "utf8");
writeFileSync(
  at("src/tenant/theme.css"),
  exampleTheme
    .replace(/\/\* Example tenant:[\s\S]*?\*\//, `/* ${name}: hue ${hue} from the brand colour ${brandColor}. */`)
    .replace(/(oklch\([^)]*?) 265\)/g, `$1 ${hue})`)
    // Very muted brands get proportionally less chroma.
    .replace(/oklch\(([\d.]+) ([\d.]+) (\d+)\)/g, (m, L, C, H) => (Number(H) === hue && c < 0.08 ? `oklch(${L} ${(Number(C) * Math.max(c / 0.08, 0.2)).toFixed(3)} ${H})` : m))
);

// ── Logo ─────────────────────────────────────────────────────────────────
rmSync(at("public/brand"), { recursive: true, force: true });
mkdirSync(at("public/brand"), { recursive: true });
let logo;
if (logoPath) {
  const src = resolve(String(logoPath));
  if (!existsSync(src)) fail(`Logo not found: ${src}`);
  const ext = extname(src).toLowerCase();
  if (![".png", ".svg"].includes(ext)) fail("Logo must be a PNG or SVG.");
  copyFileSync(src, at(`public/brand/logo-mark${ext}`));
  let width = 64;
  let height = 64;
  const buf = readFileSync(src);
  if (ext === ".png") {
    width = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
  } else {
    const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(buf.toString("utf8"));
    if (vb) [width, height] = [Math.round(Number(vb[1])), Math.round(Number(vb[2]))];
  }
  logo = { src: `/brand/logo-mark${ext}`, alt: name, width, height };
} else {
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "S";
  writeFileSync(
    at("public/brand/logo-mark.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">\n  <rect width="64" height="64" rx="14" fill="${brandColor}"/>\n  <text x="32" y="41" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="700" fill="#fff">${initials}</text>\n</svg>\n`
  );
  logo = { src: "/brand/logo-mark.svg", alt: name, width: 64, height: 64 };
}

// ── Tenant ───────────────────────────────────────────────────────────────
const flagFor = (code) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "🏳️");
const regionName = new Intl.DisplayNames(["en"], { type: "region" });
const countries = countryCodes.map((code) => ({ name: regionName.of(code) ?? code, flag: flagFor(code) }));
const placeholder = (value, text) => (value ? String(value) : `[${text}]`);
const legal = {
  organisationName: placeholder(legalName, `Registered name of ${name}`),
  physicalAddress: placeholder(address, "Street address, city, postal code"),
  jurisdiction: "ZA",
  informationOfficer: {
    name: placeholder(ioName, "Name of the Information Officer"),
    email: placeholder(ioEmail, `privacy@${emailDomain}`),
    ...(ioPhone ? { phone: String(ioPhone) } : {}),
  },
  privacyNoticeVersion: new Date().toISOString().slice(0, 10),
  religiousBody,
  retention: { membersAfterLeaving: 2, financial: 5, auditLog: 5, supportAndRequests: 2 },
  operators: [
    { name: "Supabase", purpose: "Database, sign-in and file storage", location: placeholder(supabaseRegion, "Region of the Supabase project") },
    { name: "Vercel", purpose: "Hosting the portal", location: placeholder(hostingRegion, "Region of the deployment") },
    ...(modules.training || modules.livestreams ? [{ name: "Mux", purpose: "Lesson videos and livestreams", location: "United States" }] : []),
    { name: "Resend", purpose: "Sending email (invites, newsletters, support)", location: "United States" },
  ],
};
const lighten = (t) => mix(brandColor, 255, t);
// Pretty object literal for the generated file: unquoted keys where valid.
const json = (v) => JSON.stringify(v, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, "$1:").replace(/\n/g, "\n  ");
const keyOf = (label) => slugify(label).replace(/-/g, "_");

const tenantTs = `${eventSeries.length ? 'import { CalendarDays } from "lucide-react";\n' : ""}import type { TenantConfig } from "@/lib/tenant";
import { accessPreset } from "@/lib/access-presets";
${modules.handbook ? 'import { handbook } from "./handbook";\n' : ""}
// ${name}. Everything that makes this deployment theirs rather than a
// generic Stratum portal lives in this folder; see src/lib/tenant.ts.
// Generated by scripts/new-client.mjs — edit freely.
export const tenant: TenantConfig = {
  name: ${JSON.stringify(name)},
  portalName: ${JSON.stringify(portalName)},
  description: ${JSON.stringify(description)},
  defaultOrgName: ${JSON.stringify(defaultOrgName)},
  adminNameExample: ${JSON.stringify(adminNameExample)},
  defaultCurrency: ${JSON.stringify(currency)},
  timezone: ${JSON.stringify(timezone)},
  labels: {
    group: ${JSON.stringify(groupLabel)}, groupPlural: ${JSON.stringify(plural(groupLabel))},
    location: ${JSON.stringify(locationLabel)}, locationPlural: ${JSON.stringify(plural(locationLabel))},
    cell: ${JSON.stringify(cellLabel)}, cellPlural: ${JSON.stringify(plural(cellLabel))},
  },
  modules: ${json({ ...modules, attendance: false, courses: false, messaging: false })},
  // ${preset === "church-network" ? "Church network" : "Single church"} leadership structure from core; replace with
  // your own positions (see TenantConfig.access) if it doesn't fit.
  access: accessPreset(${JSON.stringify(preset)}),
  login: {
    headline: ${JSON.stringify(`One view of every ${locationLabel.toLowerCase()}, every member, every ${groupLabel.toLowerCase()}.`)},
    blurb: "Membership, giving, training, events and livestreams — from a single dashboard built for leadership.",
  },
  affiliation: null,
  emailPlaceholder: ${JSON.stringify(`you@${emailDomain}`)},
  logo: ${json(logo)},
  chartPrimary: ${JSON.stringify(brandColor)},
  chartRamp: ${JSON.stringify([lighten(0.6), lighten(0.4), lighten(0.2), brandColor])},
  avatarColors: ${JSON.stringify([brandColor, "#0891b2", "#7c3aed", "#0d9488", "#2563eb", "#be185d", "#ca8a04"])},

  countries: ${json(countries)},

  eventSeries: [
${eventSeries.map((e) => `    { slug: ${JSON.stringify(slugify(e))}, name: ${JSON.stringify(e)}, shortName: ${JSON.stringify(e)}, icon: CalendarDays },`).join("\n")}
  ],

  captionLanguage: "en",
  lessonExamples: {
    video: ${JSON.stringify(`e.g. Welcome to ${name}`)},
    quiz: "e.g. Orientation quiz",
    videoHosts: "YouTube, Vimeo, etc.",
  },

  roster: {
    chapterPrefixes: ${JSON.stringify([name.toLowerCase()])},
    countryGuesses: [],
  },

  records: {
    // Keys are stored in the database — don't rename them once in use.
    bankAccounts: ${json(bankAccounts.map((label) => ({ key: keyOf(label), label })))},
    cellLevels: { upper: ${JSON.stringify(cellUpper)}, upperPlural: ${JSON.stringify(plural(cellUpper))}, lower: ${JSON.stringify(cellLabel)}, lowerPlural: ${JSON.stringify(plural(cellLabel))} },
    meetingTypes: ${JSON.stringify(meetingTypes)},
  },

  // Starting defaults only: the organisation keeps these current in
  // Settings → Privacy. [Placeholders] are flagged there until filled in.
  legal: ${json(legal)},
${modules.handbook ? "\n  handbook,\n" : ""}};
`;
writeFileSync(at("src/tenant/index.ts"), tenantTs);
if (!modules.handbook) rmSync(at("src/tenant/handbook"), { recursive: true, force: true });
writeFileSync(
  at("src/tenant/lint.json"),
  JSON.stringify({ _comment: "Names that must never appear as literals in core code (outside src/tenant/). Read by eslint.config.mjs.", bannedCopy: [name] }, null, 2) + "\n"
);

// ── Legal documents, names, README, seed, env ────────────────────────────
mkdirSync(at("docs/legal"), { recursive: true });
for (const f of readdirSync(at("docs/legal-templates"))) {
  writeFileSync(
    at(`docs/legal/${f}`),
    readFileSync(at(`docs/legal-templates/${f}`), "utf8")
      .replaceAll("[Organisation name]", legal.organisationName.startsWith("[") ? name : legal.organisationName)
      .replace(/^Copy this folder to `docs\/legal\/`[\s\S]*?overwrite it\.\n/m, "Filled in for this organisation from Stratum's templates (docs/legal-templates).\n")
  );
}
const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
pkg.name = slug;
writeFileSync(at("package.json"), JSON.stringify(pkg, null, 2) + "\n");
const lock = JSON.parse(readFileSync(at("package-lock.json"), "utf8"));
lock.name = slug;
if (lock.packages?.[""]) lock.packages[""].name = slug;
writeFileSync(at("package-lock.json"), JSON.stringify(lock, null, 2) + "\n");
writeFileSync(at("supabase/config.toml"), readFileSync(at("supabase/config.toml"), "utf8").replace(/^project_id = ".*"$/m, `project_id = "${slug}"`));
writeFileSync(
  at("supabase/seed.sql"),
  `-- Demo content for ${name}'s local stack (supabase db reset). Empty by default.\n`
);
writeFileSync(
  at("README.md"),
  `# ${portalName}

${description}. Built on **Stratum** — the shared engine lives upstream; this
repo holds ${name}'s tenant (\`src/tenant/\`), branding (\`public/brand/\`) and
legal documents (\`docs/legal/\`).

- **Stratum's documentation** (features, security, environment variables,
  migrations): see the Stratum repo's README.
- **Updates from Stratum:** \`git fetch upstream && git merge upstream/main\`,
  then \`npx supabase db push\` for any new migrations. (Run
  \`git config merge.ours.driver true\` once in every fresh clone.)
- **Setup answers:** \`stratum.client.json\`.
`
);
const envExample = readFileSync(at(".env.example"), "utf8");
writeFileSync(
  at(".env.local"),
  envExample
    .replace(/^SETUP_KEY=.*$/m, `SETUP_KEY=${randomBytes(32).toString("hex")}`)
    .replace(/^NEXT_PUBLIC_SITE_URL=.*$/m, `NEXT_PUBLIC_SITE_URL=${siteUrl}`),
  { mode: 0o600 }
);
const answers = {
  name, slug, portalName, description, defaultOrgName, emailDomain, adminNameExample, currency, timezone, brandColor,
  logo: logoPath || "", countries: countryCodes, structurePreset: preset,
  labels: { group: groupLabel, location: locationLabel, cell: cellLabel, cellGroup: cellUpper },
  modules, eventSeries, bankAccounts, meetingTypes, siteUrl,
  legal: { organisationName: legalName, physicalAddress: address, informationOfficer: { name: ioName, email: ioEmail, phone: ioPhone }, religiousBody, supabaseRegion, hostingRegion },
};
writeFileSync(at("stratum.client.json"), JSON.stringify(answers, null, 2) + "\n");

// ── Commit, optional GitHub repo, optional checks ────────────────────────
run("git", ["add", "-A"], target);
run("git", ["commit", "--quiet", "-m", `Set up ${name} on Stratum`], target);

if (option("github")) {
  console.log(`\nCreating private GitHub repo ${option("github")} …`);
  try {
    run("gh", ["repo", "create", option("github"), "--private", "--source", ".", "--remote", "origin"], target);
    run("git", ["push", "-u", "origin", "HEAD:main"], target);
  } catch {
    console.warn("! Couldn't create or push to the GitHub repo — do it by hand: git remote add origin <url> && git push -u origin HEAD:main");
  }
}

if (flag("install")) {
  console.log("\nInstalling and checking …");
  run("npm", ["ci", "--silent"], target);
  run("npm", ["run", "typecheck", "--silent"], target);
  run("npm", ["run", "lint", "--silent"], target);
  run("npm", ["test", "--silent"], target);
}

const gaps = [legalName, address, ioName, ioEmail, supabaseRegion, hostingRegion].filter((v) => !v).length;
console.log(`
✔ ${name} is set up in ${target}

Next:
  1. cd ${target}${flag("install") ? "" : " && npm ci"}
  2. Create a Supabase project, put its URL and keys in .env.local, then:
       npx supabase link --project-ref <ref> && npx supabase db push
  3. Apply the dashboard settings in Stratum's README → Security.
  4. Deploy, set the same env vars there (incl. SETUP_KEY and NEXT_PUBLIC_SITE_URL),
     and open /setup?key=<SETUP_KEY from .env.local> to create the first admin.
  5. ${gaps ? `Fill in the ${gaps} remaining privacy detail(s) in the portal (Settings → Privacy) and ` : ""}complete docs/legal/ — start with docs/legal/README.md.
`);
