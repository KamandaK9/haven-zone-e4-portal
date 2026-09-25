# Stratum — The Haven Zone Portal

Member management and analytics for The Haven Zone E4: members, chapters and
countries, giving and ledger, training courses, events and a member
self-service portal. Built on Next.js (App Router) and Supabase.

> This repo uses a Next.js version with breaking changes from older releases.
> Read [AGENTS.md](AGENTS.md) and the guides in `node_modules/next/dist/docs/`
> before changing framework-level code.

## Stratum vs. tenant

The codebase is split into a reusable core, **Stratum**, and the
organisation a deployment is built for, the **tenant** (here: The Haven).

| | Where | What |
|---|---|---|
| Contract | `src/lib/tenant.ts` | The `TenantConfig` type — everything core is allowed to ask a tenant for. |
| Tenant | `src/tenant/index.ts` | The Haven's values: name, portal name, logo, countries, flagship event series, lesson placeholders, roster-import hints, chart colour. |
| Tenant theme | `src/tenant/theme.css` | The `:root` / `.dark` colour tokens, imported by `src/app/globals.css`. |
| Tenant assets | `public/` | The logo referenced by `tenant.logo`. |
| Core | everything else | Generic; knows nothing about The Haven. |

The rule: **core reads the tenant only via `import { tenant } from "@/tenant"`**.
ESLint enforces it outside `src/tenant/`:

- no deep imports into the tenant folder (`@/tenant/...` or a relative path to it);
- no string, JSX, template or regex literal matching `/Haven/i`.

"Powered by Stratum KamTech" on the login page is the platform's own brand and
stays in core.

## Getting started

```bash
npm ci
cp .env.example .env.local   # then fill it in (see below)
npm run dev
```

Open <http://localhost:3000>.

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server. |
| `npm run build` / `npm start` | Production build / serve it. |
| `npm run lint` | ESLint, including the tenant-boundary rules. |
| `npm run typecheck` | `next typegen` (generates the `PageProps`/`LayoutProps` route types) then `tsc --noEmit`. |
| `npm run db:types` | Regenerates `src/lib/supabase/types.ts` from the linked Supabase project. |

CI (`.github/workflows/ci.yml`) runs `npm ci`, lint, typecheck and build on
every push and pull request.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-only. Used for setup and account bootstrap; bypasses RLS. |
| `SETUP_KEY` | for setup | Server-only. Gates `/setup` — see below. Leave empty to disable setup. |
| `NEXT_PUBLIC_SITE_URL` | recommended | Base URL for email links (invites, password resets). Falls back to the request host. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | for newsletters | Newsletter page only. Invites and password resets use Supabase's own SMTP settings (configured in the Supabase dashboard). |

## First-time setup (the setup key)

`/setup` creates the organisation and its `super_admin` account, so it is locked
down:

1. Generate a key (e.g. `openssl rand -hex 32`) and set it as `SETUP_KEY` on the
   deployment. It is server-only; never give it a `NEXT_PUBLIC_` prefix.
2. Open `https://<your-domain>/setup?key=<SETUP_KEY>` and complete the wizard.
3. That's it: **one organisation per deployment**. Once a zone has finished
   setup (`zones.setup_complete = true`) `/setup` shows "setup is closed" and
   the setup action refuses to run, key or not. You can then unset `SETUP_KEY`.

The setup action checks the key itself (constant-time comparison), so hiding
the page is not what protects it. With `SETUP_KEY` unset, setup is disabled.

## Database migrations

The schema lives in versioned migrations under `supabase/migrations/`
(`<timestamp>_baseline.sql` is the original schema, including RLS policies and
storage buckets). `supabase/seed.sql` adds demo event content; it is skipped
when no zone exists yet.

The Supabase CLI is a dev dependency (`npx supabase ...`).

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push              # apply pending migrations
npm run db:types                  # regenerate src/lib/supabase/types.ts
```

To add a change: `npx supabase migration new <name>`, write the SQL, `db push`,
then `npm run db:types`. `types.ts` was hand-written until now, so review the
diff the first time you regenerate it.

**Existing databases** that already ran the old `migration.sql` by hand: mark the
baseline as applied instead of re-running it (it is idempotent, but there's no
need):

```bash
npx supabase migration repair --status applied <baseline-timestamp>
```

Local development against a local stack: `npx supabase start`, then
`npx supabase db reset` to apply migrations and the seed.

## Building for a new client

Core stays as it is; you write a new tenant.

1. **Replace `src/tenant/index.ts`.** Export `tenant: TenantConfig` (from
   `@/lib/tenant`). TypeScript tells you what's missing:
   - `name`, `portalName`, `description`, `defaultOrgName`, `emailPlaceholder`
   - `logo` — put the image in `public/` and give its intrinsic size
   - `chartPrimary` — single-series chart colour; match `--primary`
   - `countries` — pre-listed on the setup wizard, with flags
   - `eventSeries` — flagship recurring events (slug, names, lucide icon). The
     slug is the URL and the key existing `event_series` rows are matched on,
     so don't change slugs after launch.
   - `lessonExamples` — placeholder lesson titles
   - `roster.chapterPrefixes` / `roster.countryGuesses` — hints for the
     leadership-roster import (use empty arrays if they don't apply)
2. **Replace `src/tenant/theme.css`** with the client's `:root` and `.dark`
   colour tokens (same variable names).
3. **Swap assets** in `public/` (logo, `src/app/favicon.ico`).
4. **New Supabase project**: link it, `db push` the migrations, set the env
   vars (including a fresh `SETUP_KEY`), deploy, and run `/setup?key=...`.
5. Run `npm run lint && npm run typecheck && npm run build`. Consider adding
   the new client's name to the `no-restricted-syntax` pattern in
   `eslint.config.mjs` (it currently bans `/Haven/i`) so their copy can't leak
   into core either.

One deployment serves one organisation; a new client gets its own deployment
and database.
