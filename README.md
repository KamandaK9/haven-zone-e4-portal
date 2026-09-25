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
| Tenant | `src/tenant/index.ts` | The Haven's values: names and copy, logo, colours, default currency, countries, flagship event series, lesson placeholders, roster-import hints. |
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
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY` | for hosted video | Server-only. Enables uploading training videos — see [Hosted training video](#hosted-training-video). |
| `MUX_WEBHOOK_SECRET` | recommended with Mux | Server-only. Verifies Mux webhooks at `/api/mux/webhook`. |
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

## Hosted training video

A Stratum feature, available to every tenant. Video lessons can take an
uploaded video instead of a pasted YouTube/Vimeo link, hosted on
[Mux](https://www.mux.com) (its free plan covers 10 videos; pay-as-you-go after).

- **Upload or record**: the lesson editor takes a video file, or records one
  right there in the browser — camera, screen, or screen with the presenter
  in a corner bubble (screen options are desktop-only). Recordings have a
  countdown, pause/resume, a mic level meter, camera/mic pickers, a review
  step with "record again", and stop automatically at 45 minutes. Either
  way, the file goes straight from the browser to Mux in resumable 5 MB
  chunks — it never passes through this server.
- **Private playback**: videos use Mux's signed playback policy. The member's
  course page mints a short-lived token per viewing, so a copied link doesn't
  play elsewhere.
- **Watch to complete**: the player reports played time (seeking ahead doesn't
  count) every 15 seconds; the lesson completes itself at 90% watched. The
  server credits time no faster than real time allows (up to 2× speed), and
  a database trigger (`guard_lesson_progress`) stops members writing watch
  time or completing a hosted lesson directly. Staff can still mark a member
  complete (e.g. they watched it together in person).
- **Captions**: generated automatically in `tenant.captionLanguage` (`null`
  turns them off).
- **Duration** comes from the video itself.

Pasted links keep working exactly as before (members mark those complete
themselves), and with the `MUX_*` variables unset the upload option doesn't
appear at all.

**One Mux environment per client deployment.** Each deployment needs its
own webhook URL and signing keys, which Mux scopes to an environment — so
when you set up a new client, create a new environment in the Mux dashboard
(or have the client use their own Mux account, so hosting is billed to them).

Setup: create a Mux account → an access token (Mux Video read + write) and a
URL signing key → set the four `MUX_*` variables. Then add a webhook for
`https://<your-domain>/api/mux/webhook` and set `MUX_WEBHOOK_SECRET`. Without a
webhook (e.g. local dev), use "Check status" in the lesson editor once a video
has processed.

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
   - `name`, `portalName`, `description`, `defaultOrgName`, `emailPlaceholder`,
     `adminNameExample`
   - `login.headline` / `login.blurb` — the login page's marketing panel;
     `affiliation` — parent-organisation line under it (`null` to hide)
   - `defaultCurrency` — display currency a new org starts with
   - `logo` — put the image in `public/` and give its intrinsic size
   - `chartPrimary` — single-series chart colour; match `--primary`
   - `chartRamp` — ordinal chart ramp, light → dark; `avatarColors` — palette
     for members' initials avatars
   - `countries` — pre-listed on the setup wizard, with flags
   - `eventSeries` — flagship recurring events (slug, names, lucide icon). The
     slug is the URL and the key existing `event_series` rows are matched on,
     so don't change slugs after launch.
   - `lessonExamples` — placeholder lesson titles, and the video hosts the org
     uses (`videoHosts`)
   - `captionLanguage` — language uploaded videos are auto-captioned in
     (`"en"`, `"pt"`, …, `"auto"`), or `null` for none
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
