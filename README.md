# Stratum

A member-management portal for church networks and similar membership
organisations: a leadership hierarchy with scoped permissions, members and
chapters, giving and ledger, training courses with hosted video, events,
livestreams with live chat, a handbook that ties the organisation's rules to
live data, chapter records (cells, minutes, correspondence, bank advices,
cheques), a Help button with a support inbox, and a member self-service
portal. Built on Next.js (App Router) and Supabase.

This repo is the **core**. It ships with an example tenant ("Example Church")
so it runs out of the box; each client gets its own repo made from this one
(see [A new client](#a-new-client)).

> This repo uses a Next.js version with breaking changes from older releases.
> Read [AGENTS.md](AGENTS.md) and the guides in `node_modules/next/dist/docs/`
> before changing framework-level code.

## Core vs. tenant

| | Where | What |
|---|---|---|
| Contract | `src/lib/tenant.ts` | The `TenantConfig` type — everything core is allowed to ask a tenant for. |
| Tenant | `src/tenant/index.ts` | Names and copy, logo, colours, default currency, countries, flagship event series, lesson placeholders, roster-import hints, bank accounts, cell level names, meeting types. |
| Tenant handbook | `src/tenant/handbook/` | The organisation's operating manual as typed data (optional). |
| Tenant theme | `src/tenant/theme.css` | The `:root` / `.dark` colour tokens, imported by `src/app/globals.css`. |
| Tenant lint names | `src/tenant/lint.json` | Names core code must never contain. |
| Tenant assets | `public/brand/` | The logo referenced by `tenant.logo`. |
| Core | everything else | Generic; knows nothing about any one organisation. |

The rule: **core reads the tenant only via `import { tenant } from "@/tenant"`**.
ESLint enforces it outside `src/tenant/`:

- no deep imports into the tenant folder (`@/tenant/...` or a relative path to it);
- no string, JSX, template or regex literal containing a name from
  `src/tenant/lint.json`.

"Powered by Stratum KamTech" on the login page is the platform's own brand and
stays in core.

**Still organisation-shaped in core** (fine for church networks; worth
generalising before a very different client): the leadership positions and
their default permissions (`src/lib/access.ts`), the zone → sub-zone →
chapter structure (`zones`, `sub_zones`, `churches` tables), and the
leadership-roster spreadsheet importer.

## A client's own logic (extensions)

Settings go in `src/tenant/index.ts`; a client's **own behaviour** goes in
`src/tenant/extensions.ts` (server-only, so it can hold secrets and call other
systems). Neither is ever overwritten by a Stratum update.

- **Pages**: declare `extensionPages: [{ slug, label, icon, cap }]` in the
  tenant config and put the page body in `extensions.pages[slug]` — it appears
  in the sidebar at `/x/<slug>`, for whoever holds `cap`.
- **Dashboard cards**: `extensions.dashboardCards`.
- **Hooks** for integrations: `onMembersCreated` (manual, import or setup),
  `onMemberUpdated`, `onMemberDeleted`, `onGivingImported`, and `daily` (runs
  with the daily job). They run after the core action has succeeded and the
  response has gone; a failure is logged and never affects the action.

If a client needs something core doesn't offer a slot for, add the slot to
Stratum (so every client can use it) rather than editing core in the client
repo.

## Structure: country first or sub-zone first

By default the structure pages go Countries → locations. A tenant that thinks
in sub-zones sets `structureRoot: "group"`: the sidebar then opens
**Sub-zones** (`/sub-zones`), each with its countries, locations and cells, a
written history the Directors edit, and its leaders over time. Set
`access.groupLeaderPositionKey` / `locationLeaderPositionKey` to the positions
that lead a sub-zone and a location. Leadership history (`position_history`)
is recorded automatically whenever a member's position or location changes;
Directors add earlier leaders by hand.

## Member fields & imports (no code per client)

An organisation's extra details about people — a baptism date, a department —
are **member fields**, set up in the portal (Settings → Member fields), not in
code. Each field has a type (text, number, date, choice, yes/no), which leaders
see it (all leaders / leaders who see contact details / admins only) and
whether members see or edit their own. Values live one row per member and
field in `member_field_values`, so the database enforces each field's
visibility (`can_access_member_field`).

Importing members, the admin **matches each spreadsheet column** to a member
detail, one of their fields, a new field made on the spot, or "Don't import".
Ticking "Remember these choices" saves it as the organisation's import
template (`import_templates`), so their next sheet matches itself. Fields and
the template need `manage_settings`; importing needs `manage_members`.

Adding a field that collects a new kind of information? Check the privacy
notice still covers it.

## Security

The data is personal and financial, so the rule is: **the server never sends
or accepts anything a person isn't allowed** — hiding things in the browser
is not protection.

- **Database (Row Level Security + guard triggers)** decides every read and
  write, including from someone calling Supabase directly with the public
  anon key. Where people may update their own row, triggers limit *which
  columns* (e.g. a member can change only their email and phone; positions
  and logins change only through Team & access). `npm run test:db` replays
  every migration into an in-process Postgres and tries each known attack —
  it runs in CI.
- **Server Actions** check the signed-in profile and capability before doing
  anything, and the service-role key is used only after those checks
  (`server-only` modules).
- **Files**: paperwork is in a private bucket, opened through 5-minute signed
  links issued after a permission check; every stored file path must sit in
  its owner's folder (database constraint), and the server re-checks before
  deleting.
- **Browser**: a per-request nonce Content-Security-Policy (only this site's
  scripts run; only the services listed in `src/lib/security-headers.ts` can
  be contacted), HSTS, no framing, strict referrer policy.
- **Sign-in**: optional authenticator-app two-step sign-in (`/security`);
  passwords of 10+ characters with letters and numbers; temporary passwords
  must be replaced at first sign-in; leaders are signed out after 30 minutes
  idle, members after 7 days; email links can only redirect within the site.
- **Rate limits** on invites, newsletters, support requests, chat and quiz
  attempts (`take_rate_limit`).

### Supabase dashboard settings (per project)

`supabase/config.toml` only applies to a local stack. On each hosted project,
under **Authentication**:

- **Sign In / Providers → Email**: turn **Allow new users to sign up** off
  (accounts come from setup and invites); **Secure password change** on.
- **Passwords**: minimum length **10**, require **letters and digits**;
  turn on leaked-password protection if your plan has it.
- **Multi-Factor**: enable **TOTP (authenticator app)**.
- **URL Configuration**: Site URL = the deployment's URL, and only its
  `/auth/confirm` in the redirect allow-list. Also set
  `NEXT_PUBLIC_SITE_URL` on the deployment.
- **Attack protection**: enable CAPTCHA if you see sign-in abuse.

When adding a feature that talks to a new outside service from the browser
(an embed, a script, an API), add its origin to `src/lib/security-headers.ts`
or the browser will block it.

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
| `npm run new-client -- --dir …` | Set up a new client repo (see A new client). |
| `npm test` / `npm run test:db` | Unit tests / database security tests (RLS and guard triggers, in-process Postgres). |
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
| `VIDEO_PROVIDER` | optional | Which video host new uploads go to (`mux`). Defaults to the first one configured — see [Hosted training video](#hosted-training-video). |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY` | for Mux | Server-only. Configures the Mux video host. |
| `MUX_WEBHOOK_SECRET` | recommended with Mux | Server-only. Verifies Mux webhooks at `/api/video/mux/webhook`. |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | for newsletters | Newsletter page only. Invites and password resets use Supabase's own SMTP settings (configured in the Supabase dashboard). |
| `SUPPORT_EMAIL` | optional | Where Help-button requests are emailed (needs the Resend settings). Without it they're kept in Settings → Support requests only. |

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
uploaded or in-portal-recorded video instead of a pasted YouTube/Vimeo link.

- **Upload or record**: the lesson editor takes a video file, or records one
  right there in the browser — camera, screen, or screen with the presenter
  in a corner bubble (screen options are desktop-only). Recordings have a
  countdown, pause/resume, a mic level meter, camera/mic pickers, a review
  step with "record again", and stop automatically at 45 minutes. Either
  way, the file goes straight from the browser to the video host — it never
  passes through this server.
- **Private playback**: the member's course page gets short-lived playback
  credentials per viewing, so a copied link doesn't play elsewhere.
- **Watch to complete**: the player reports played time (seeking ahead doesn't
  count) every 15 seconds; the lesson completes itself at 90% watched. The
  server credits time no faster than real time allows (up to 2× speed), and
  a database trigger (`guard_lesson_progress`) stops members writing watch
  time or completing a hosted lesson directly. Staff can still mark a member
  complete (e.g. they watched it together in person).
- **Captions**: generated automatically in `tenant.captionLanguage` (`null`
  turns them off), where the host supports it.
- **Duration** comes from the video itself.

Pasted links keep working exactly as before (members mark those complete
themselves), and with no video host configured the upload/record options
don't appear at all.

### Video hosts

Hosting is pluggable, so each client deployment can use whichever host
suits it. Available now:

| Host | `VIDEO_PROVIDER` | Notes |
|---|---|---|
| [Mux](https://www.mux.com) | `mux` | Free plan covers 10 videos, pay-as-you-go after. Signed playback, auto-captions, adaptive streaming. |

`VIDEO_PROVIDER` picks the host for new uploads (default: the first one whose
env vars are set). Each lesson remembers its host, so switching a deployment
to another host doesn't break videos already uploaded.

Each host's webhook goes to `https://<your-domain>/api/video/<provider>/webhook`.
Without a webhook (e.g. local dev), use "Check status" in the lesson editor
once a video has processed.

**Mux setup**: create an account → an access token (Mux Video read + write)
and a URL signing key → set the four `MUX_*` variables. Add a webhook for
`https://<your-domain>/api/video/mux/webhook` and set `MUX_WEBHOOK_SECRET`.
Use **one Mux environment per client deployment** (webhooks and signing keys
are scoped to an environment), or have the client use their own Mux account
so hosting is billed to them.

**Adding a host** (e.g. Bunny Stream, Cloudflare Stream):

1. Write `src/lib/video/providers/<host>.ts` implementing `VideoProvider`
   (`src/lib/video/providers/types.ts`): create an upload, report upload and
   video status, delete, mint playback, verify webhooks.
2. Register it in `src/lib/video/providers/index.ts` and add its id to
   `VIDEO_PROVIDER_IDS` in `src/lib/video/provider.ts`.
3. If it uploads differently (e.g. tus) or plays differently (e.g. plain HLS),
   add a variant to `UploadTarget` / `PlaybackSource` and a branch in the
   lesson editor's `uploadFile` / `HostedVideoPlayer`. TypeScript flags every
   place that needs one.
4. Add a migration extending the `training_lessons.video_provider` check
   constraint.

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

**Never name a tenant's positions in SQL.** A migration that gives existing
logins a new capability must not list position keys (some old ones do — they're
already applied, and do nothing on a new database); see `src/lib/access.ts`.

Local development against a local stack: `npx supabase start`, then
`npx supabase db reset` to apply migrations and the seed.

## A new client

Each client gets **their own repo, deployment and database**, made from this
one — and keeps receiving Stratum updates.

### Start the client repo — one command

```bash
npm run new-client -- --dir ../<client>-portal                  # asks questions
npm run new-client -- --dir ../<client>-portal --config answers.json --yes --install
```

The script (`scripts/new-client.mjs`, Node built-ins only) clones this
checkout into the new folder with Stratum as the `upstream` remote, then
writes everything that makes the portal the client's:

- `src/tenant/index.ts` — names, labels, currency, time zone, countries, the
  modules to switch on, a leadership structure from `src/lib/access-presets.ts`
  (church network or single church), event series, bank accounts, meeting
  types and the privacy (`legal`) details;
- `src/tenant/theme.css` from one brand colour; the logo (PNG/SVG, or
  initials); `src/tenant/lint.json`;
- `docs/legal/` from the templates; package and Supabase project names; a
  short README; an empty seed;
- `.env.local` with a fresh `SETUP_KEY`; `git config merge.ours.driver true`;
- `stratum.client.json` — the answers, for the record.

It commits the result, and with `--github owner/name` creates the client's
private repo and pushes; with `--install` it installs and runs typecheck, lint
and tests. See `stratum.client.example.json` for every answer. Anything left
blank in the privacy details becomes a `[placeholder]` that Settings flags.

Then: create the client's Supabase project and `npx supabase link` +
`db push`, apply the dashboard settings (Security above), deploy with the env
vars, open `/setup?key=…`, and work through `docs/legal/README.md`.

### Pulling Stratum updates

Build core features here, in Stratum. In each client repo:

```bash
git fetch upstream
git merge upstream/main
```

`.gitattributes` marks the tenant's own files (`src/tenant/**`,
`public/brand/**`, `supabase/seed.sql`, `README.md`) as `merge=ours`: when
both sides changed one, the client's version wins. That needs
`git config merge.ours.driver true` once per clone. If an update adds a field
to `TenantConfig`, the merge still succeeds and `npm run typecheck` points at
what the client's tenant needs to add.

**All clients at once:** list your client repos in `clients.local.json`
(git-ignored; `[{ "name": "haven", "path": "../haven-portal", "base": "main" }]`)
and run `npm run update-clients` (`--dry-run` to preview, `--only <name>`). Each
client gets a PR with what's new and which migrations it brings; test the
preview and merge. A conflict stops only that client.

**Deploying** is automatic once a client repo is set up (`deploy/README.md`):
after CI passes on `main`, the deploy workflow applies new migrations to the
client's database, then deploys the app — on Vercel or on a server (Docker; one
VPS can hold many clients). Until then, apply migrations by hand after merging
(`npx supabase db push`). `npm run db:check` tells you, read-only, whether a
live database has everything the code needs.
