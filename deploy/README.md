# Deploying a client portal

Every client repo deploys the same way: **CI passes on `main` → the database
gets any new migrations → the app is deployed.** The workflow is
`.github/workflows/deploy.yml`; it does nothing until the repo is set up below.
Where the app runs is the client's choice: **Vercel**, or **a server** (a VPS —
one server can hold many clients — or the client's own machine).

## 1. The database (every client)

1. In GitHub → the client repo → Settings → Secrets and variables → Actions,
   add the secret **`DATABASE_URL`**: Supabase → Project Settings → Database →
   connection string (URI), with the password filled in. A self-hosted
   Supabase works the same way.
2. **Once, for a database whose migrations were run by hand** (e.g. pasted into
   the SQL editor): run `npm run db:check` until it reports nothing missing,
   then `npm run db:check -- --repair-command` and run the command it prints.
   That records them as applied. The workflow refuses to touch a database with
   tables but no record, so it can never replay old one-off fixes.

Anytime: `npm run db:check` (read-only) tells you whether a live database has
everything the code needs.

## 2a. On Vercel

1. Vercel → the project → Settings → Git → Deploy Hooks: create a hook for
   `main`; add it as the secret **`VERCEL_DEPLOY_HOOK`**.
2. Add the variable **`DEPLOY_TARGET`** = `vercel`.
3. In the client's `vercel.json`, stop Vercel deploying `main` by itself (the
   hook does it, after the database), keeping previews for other branches:
   ```json
   { "git": { "deploymentEnabled": { "main": false } } }
   ```
   (merged with the `crons` entry already there). Set **`CRON_SECRET`** in the
   Vercel environment so the daily job runs.

## 2b. On a server

### Preparing a server (once)
On a fresh Ubuntu VPS:
```sh
# Docker
curl -fsSL https://get.docker.com | sh
# Firewall: SSH and web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
# A deploy user that can run docker
adduser --disabled-password deploy && usermod -aG docker deploy
mkdir -p /srv/stratum/clients && chown -R deploy /srv/stratum
```
Copy this folder's files to `/srv/stratum`: `docker-compose.example.yml` →
`docker-compose.yml`, `Caddyfile.example` → `Caddyfile`, and `cron/`.
Let the server pull private images: as `deploy`, run
`docker login ghcr.io` with a GitHub token that has `read:packages`.
`docker compose up -d caddy scheduler`.

### Adding a client to the server
1. `clients/<name>.env` (chmod 600) with the client's runtime settings — the
   same as their `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_SITE_URL`, `SETUP_KEY`, `CRON_SECRET`, and any mail/video keys.
2. A service named `<name>` in `docker-compose.yml` (copy the example block;
   image `ghcr.io/<owner>/<repo>:latest`, all lowercase).
3. A block for their domain in `Caddyfile`; point the domain's DNS (A record)
   at the server; `docker compose restart caddy`. HTTPS is automatic.
4. In the client's GitHub repo:
   - variables: **`DEPLOY_TARGET`** = `server`, **`DEPLOY_SERVICE`** = `<name>`,
     `DEPLOY_PATH` (if not `/srv/stratum`), and the public build values
     **`NEXT_PUBLIC_SUPABASE_URL`**, **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**,
     **`NEXT_PUBLIC_SITE_URL`** (Next.js builds these into the app);
   - secrets: **`DEPLOY_HOST`**, **`DEPLOY_USER`** (`deploy`),
     **`DEPLOY_SSH_KEY`** (a private key whose public half is in the deploy
     user's `~/.ssh/authorized_keys`), optionally **`DEPLOY_KNOWN_HOSTS`**
     (`ssh-keyscan <host>`).
5. Push to `main` (or run the Deploy workflow by hand): the image is built,
   pushed to GitHub's registry, and the server pulls and restarts that client.

The scheduler calls each client's `/api/cron/daily` at 05:00 using the
`CRON_SECRET` in its env file — nothing to add per client.

### Keeping it safe
- `clients/*.env` hold each client's keys: readable by the deploy user only,
  never committed, and backed up somewhere private (losing them means
  re-issuing keys).
- Each client runs in its own container with its own database; one client
  can't see another's.
- `docker compose logs <name>` for a client's logs; `docker stats` for memory.
  Each client container is capped at 768 MB in the example — a small VPS
  (4 GB) holds several.

### Data on your own server too (optional)
For a client who wants their data off public cloud, Supabase can be
self-hosted (Supabase's Docker setup) on the same or a separate server. The
portal needs no changes — its env file just points at that Supabase's URL and
keys, and `DATABASE_URL` at its Postgres. You then own backups: schedule
`pg_dump` off the server.
