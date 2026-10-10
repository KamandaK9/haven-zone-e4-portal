#!/usr/bin/env node
// Sends the latest Stratum to every client as a pull request.
//
//   npm run update-clients               (every client in clients.local.json)
//   npm run update-clients -- --only haven
//   npm run update-clients -- --dry-run  (just show what each would get)
//   npm run update-clients -- --check    (also run lint/types/tests locally first)
//
// For each client: fetches Stratum (the client's `upstream` remote) and the
// client's own repo, merges Stratum into a new branch off the client's base
// branch — in a separate worktree, so whatever you have checked out there is
// untouched — pushes it and opens a PR listing what's new and any database
// migrations it brings. The PR gets the client's CI (and a Vercel preview);
// merging it deploys (deploy/README.md). A conflict stops that client only.
//
// clients.local.json (git-ignored, yours):
//   [{ "name": "haven", "path": "../TheHavenZoneE4Portal", "base": "main" }]
// Node built-ins plus git and gh.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STRATUM = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const only = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : undefined;

const configPath = join(STRATUM, "clients.local.json");
if (!existsSync(configPath)) {
  console.error(`No ${configPath}. Create it, e.g.\n  [{ "name": "haven", "path": "../TheHavenZoneE4Portal", "base": "main" }]`);
  process.exit(1);
}
const clients = JSON.parse(readFileSync(configPath, "utf8")).filter((c) => !only || c.name === only);

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (cwd, ...args) => {
  try {
    return { ok: true, out: git(cwd, ...args) };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.message) };
  }
};

const date = new Date().toISOString().slice(0, 10);
const results = [];

for (const client of clients) {
  const repo = resolve(STRATUM, client.path);
  const base = client.base ?? "main";
  const label = `${client.name} (${base})`;
  try {
    git(repo, "fetch", "--quiet", "upstream");
    git(repo, "fetch", "--quiet", "origin");
    const pending = git(repo, "log", "--oneline", "--no-merges", `origin/${base}..upstream/main`);
    if (!pending) {
      results.push([label, "already up to date"]);
      continue;
    }
    const migrations = git(repo, "diff", "--name-only", "--diff-filter=A", `origin/${base}...upstream/main`, "--", "supabase/migrations")
      .split("\n")
      .filter(Boolean);
    if (flag("dry-run")) {
      results.push([label, `${pending.split("\n").length} change(s), ${migrations.length} migration(s) — not sent (dry run)`]);
      console.log(`\n${label}:\n${pending}\n${migrations.map((m) => `  + ${m}`).join("\n")}`);
      continue;
    }

    let branch = `stratum-update-${date}`;
    for (let n = 2; tryGit(repo, "rev-parse", "--verify", "--quiet", `origin/${branch}`).ok; n++) branch = `stratum-update-${date}-${n}`;
    const work = mkdtempSync(join(tmpdir(), `stratum-${client.name}-`));
    rmSync(work, { recursive: true, force: true });
    git(repo, "worktree", "add", "--quiet", "-b", branch, work, `origin/${base}`);
    try {
      // Client-owned files keep the client's version on a conflict (.gitattributes).
      const merged = tryGit(work, "-c", "merge.ours.driver=true", "merge", "--no-edit", "upstream/main");
      if (!merged.ok) {
        const conflicts = tryGit(work, "diff", "--name-only", "--diff-filter=U").out;
        tryGit(work, "merge", "--abort");
        results.push([label, `CONFLICT — merge by hand. Files: ${conflicts.replace(/\n/g, ", ")}`]);
        continue;
      }
      if (flag("check")) {
        for (const cmd of [["ci", "--silent"], ["run", "lint", "--silent"], ["run", "typecheck", "--silent"], ["test", "--silent"]]) {
          execFileSync("npm", cmd, { cwd: work, stdio: "inherit" });
        }
      }
      git(work, "push", "--quiet", "-u", "origin", branch);
      const body = [
        "Latest Stratum, merged for this client.",
        "",
        "**What's new**",
        ...pending.split("\n").map((l) => `- ${l}`),
        "",
        migrations.length
          ? `**Database migrations (${migrations.length})** — applied automatically when this is merged (deploy workflow), or by hand in order:\n${migrations.map((m) => `- \`${m}\``).join("\n")}`
          : "**No database migrations.**",
        "",
        "Test the preview, then merge. `npm run db:check` shows whether the live database is up to date.",
      ].join("\n");
      const pr = execFileSync("gh", ["pr", "create", "--base", base, "--head", branch, "--title", `Stratum update ${date}`, "--body", body], {
        cwd: work,
        encoding: "utf8",
      }).trim();
      results.push([label, `PR opened: ${pr}`]);
    } finally {
      tryGit(repo, "worktree", "remove", "--force", work);
    }
  } catch (e) {
    results.push([label, `FAILED — ${String(e.stderr || e.message).split("\n")[0]}`]);
  }
}

console.log("\nStratum update:");
for (const [label, outcome] of results) console.log(`  ${label}: ${outcome}`);
process.exit(results.some(([, o]) => /CONFLICT|FAILED/.test(o)) ? 1 : 0);
