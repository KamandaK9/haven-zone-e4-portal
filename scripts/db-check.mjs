#!/usr/bin/env node
// Checks a live database has every migration this code needs.
//
//   npm run db:check                 (reads .env.local)
//   npm run db:check -- --env .env.production
//   npm run db:check -- --repair-command   (once, for a database whose
//       migrations were applied by hand: prints the command that records
//       them as applied, so `supabase db push` only runs new ones)
//
// Read-only: asks the project's API for its schema (with the service key)
// and compares it with the tables, columns and callable functions that
// supabase/migrations/* create. Prints the migrations that look missing and
// exits 1 if any are, so a deploy can stop before new code meets an old
// database. Changes that leave no trace in the API (policies, triggers,
// backfills) can't be seen this way — `supabase db push` tracks those.
// Node built-ins only.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const envFile = argv.includes("--env") ? argv[argv.indexOf("--env") + 1] : ".env.local";

function readEnv(path) {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(resolve(ROOT, path), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No file: rely on the environment (as in CI).
  }
  return env;
}

const env = readEnv(envFile);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(`Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from ${envFile} or the environment).`);
  process.exit(2);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
});
if (!res.ok) {
  console.error(`The API answered ${res.status} — check the URL and service key.`);
  process.exit(2);
}
const spec = await res.json();
const tables = spec.definitions ?? {};
const rpcs = new Set(Object.keys(spec.paths ?? {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)));

// What each migration creates that the API can see.
const dir = join(ROOT, "supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
// Functions any migration keeps from signed-in users aren't in the API.
const hidden = new Set();
for (const file of files) {
  for (const m of readFileSync(join(dir, file), "utf8").matchAll(/revoke execute on function (?:public\.)?(\w+)\([^)]*\) from ([^;]*)/gi)) {
    if (/authenticated/i.test(m[2])) hidden.add(m[1]);
  }
}
const missing = [];
for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  const gone = new Set();
  for (const m of sql.matchAll(/create table if not exists (?:public\.)?(\w+)/gi)) {
    if (!tables[m[1]]) gone.add(m[1]);
  }
  for (const m of sql.matchAll(/alter table (?:public\.)?(\w+) add column if not exists (\w+)/gi)) {
    if (tables[m[1]] && !(m[2] in (tables[m[1]].properties ?? {}))) gone.add(`${m[1]}.${m[2]}`);
  }
  // Functions meant to be called through the API (not trigger functions,
  // and not ones kept from every API role).
  for (const m of sql.matchAll(/create or replace function (?:public\.)?(\w+)\s*\(([^)]*)\)\s*returns\s+(\w+)/gi)) {
    const [, name, , returns] = m;
    if (returns.toLowerCase() !== "trigger" && !hidden.has(name) && !rpcs.has(name)) gone.add(`${name}()`);
  }
  if (gone.size) missing.push({ file, gone: [...gone] });
}

if (argv.includes("--repair-command")) {
  if (missing.length) {
    console.log("Apply the missing migrations first (listed below), then run this again.\n");
  } else {
    const versions = files.map((f) => f.split("_")[0]);
    console.log("Run once, from this repo (DATABASE_URL: Supabase → Project Settings → Database → connection string, with the password filled in):\n");
    console.log(`  npx supabase migration repair --db-url "<DATABASE_URL>" --status applied ${versions.join(" ")}\n`);
    process.exit(0);
  }
}

if (missing.length === 0) {
  console.log("✓ The database has everything this code needs.");
  process.exit(0);
}
console.log(`✗ ${missing.length} migration(s) look missing — apply them in this order:\n`);
for (const m of missing) console.log(`  ${m.file}\n      ${m.gone.join(", ")}`);
console.log("\nWith the CLI linked: npx supabase db push   (or run each file in the SQL editor, in order)");
process.exit(1);
