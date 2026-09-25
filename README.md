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

Local development against a local stack: `npx supabase start`, then
`npx supabase db reset` to apply migrations and the seed.

## A new client

Each client gets **their own repo, deployment and database**, made from this
one — and keeps receiving Stratum updates.

### Start the client repo

```bash
git clone https://github.com/KamandaK9/stratum.git <client>-portal
cd <client>-portal
git remote rename origin upstream            # Stratum
git remote add origin <the client's new GitHub repo>
git config merge.ours.driver true            # see "Pulling Stratum updates"
```

Then make it theirs, in one commit:

1. **`src/tenant/index.ts`** — export `tenant: TenantConfig` (from
   `@/lib/tenant`). TypeScript tells you what's missing. Slugs in
   `eventSeries` and keys in `records.bankAccounts` are stored in the
   database, so don't change them after launch.
2. **`src/tenant/handbook/`** — their operating manual (or remove `handbook`
   from the tenant to hide the Handbook).
3. **`src/tenant/theme.css`** — their colour tokens (same variable names).
4. **`src/tenant/lint.json`** — their name(s), so it can't leak into core.
5. **`public/brand/`** — their logo; also `src/app/favicon.ico`.
6. `README.md`, `supabase/seed.sql`, and the `name` in `package.json` /
   `project_id` in `supabase/config.toml`.
7. New Supabase project: link it, `db push` the migrations, set the env vars
   (including a fresh `SETUP_KEY`), deploy, and run `/setup?key=...`.
8. `npm run lint && npm run typecheck && npm test && npm run build`.

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

Apply new migrations to the client's database after merging
(`npx supabase db push`).
