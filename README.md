# CE Sandton Portal

Member management, church-service attendance, Foundation School and
SMS/email communication for CE Sandton. Built on
[Stratum](https://github.com/KamandaK9/stratum) (Next.js App Router +
Supabase) — see that repo's README for the shared core, and
`src/tenant/index.ts` here for everything specific to this deployment
(roles, labels, branding, which modules are on).

> This repo uses a Next.js version with breaking changes from older
> releases. Read [AGENTS.md](AGENTS.md) and the guides in
> `node_modules/next/dist/docs/` before changing framework-level code.

## Remotes

- `origin` — this repo (KamandaK9/ce-sandton-portal).
- `upstream` — Stratum. Pull core updates with `git fetch upstream && git
  merge upstream/main` (`git config merge.ours.driver true` once per clone —
  `src/tenant/**`, `public/brand/**`, `supabase/seed.sql` and this file
  always keep CE Sandton's own version on a merge conflict).

## Status

Early build. See the build plan for what's done and what's next.
