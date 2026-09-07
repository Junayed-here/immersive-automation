# Deploying to Netlify

One Netlify site, git-connected. The Next.js app (`apps/web`) is the site's
main build; the Express API (`apps/api`) is wrapped as a Netlify Function and
reached **same-origin** via a `/api/*` redirect (`netlify.toml`, repo root) —
not a separate API host. See `CLAUDE.md`'s "Deploy target: Netlify" section
and `docs/build-progress.md`'s migration writeup for the architecture; this
doc is just the step-by-step.

## 1. Prerequisites

- **A Supabase project** (free tier is fine). Once created:
  - Open the SQL editor and run the full contents of `apps/api/src/db/schema.sql`.
  - Get the connection string from *Project Settings → Database → Connection
    string*. Use the **Transaction pooler** string (port `6543`, not the
    direct `5432` one) — Netlify Functions are short-lived, and the pooler is
    what makes that safe against Supabase's connection limit.
- **A Resend account** and API key (resend.com/api-keys). Until you verify
  your own sending domain there, `MAIL_FROM` must stay
  `onboarding@resend.dev`, and Resend only delivers to the email address on
  your own Resend account — enough to verify the pipe, not for real buyers.
- **A Netlify account**, with this repo pushed somewhere Netlify can read it
  (GitHub/GitLab/Bitbucket).

## 2. Connect the repo

In Netlify: **Add new site → Import an existing project**, pick this repo.
Netlify will read `netlify.toml` from the repo root automatically — you
shouldn't need to fill in the build settings by hand (base directory, build
command, publish directory, functions directory are all already set there).
Don't click "Deploy" yet — set the environment variables first (§3), since the
build needs some of them.

## 3. Environment variables

*Site configuration → Environment variables* in Netlify. These map 1:1 to
`apps/api/.env.example`, with a few values specific to production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase **Transaction pooler** connection string |
| `JWT_SECRET` | a long random string (`openssl rand -hex 32`) |
| `LINK_SECRET` | a different long random string — don't reuse `JWT_SECRET` |
| `INTERNAL_DRAIN_SECRET` | another random string — shared secret gating `netlify/functions/drain.js` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | the one Admin account (see §5 — this only takes effect when you run the seed script) |
| `SHEET_FETCHER` | `http` (not `local` — there are no fixture files in production) |
| `LISTINGS_PROVIDER` | `mock` or `zillow`, matching whichever you've built against |
| `ZILLOW_API_KEY` | only if `LISTINGS_PROVIDER=zillow` |
| `MAIL_TRANSPORT` | `smtp` |
| `SMTP_HOST` | `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `resend` (literally that string, not your email) |
| `SMTP_PASSWORD` | your Resend API key |
| `MAIL_FROM` | `Listing Bot <onboarding@resend.dev>` until you verify a domain in Resend |
| `APP_URL` | your deployed site's URL, e.g. `https://your-site.netlify.app` (fill this in **after** the first deploy gives you the URL, then redeploy) |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | *(leave empty)* — same-origin means every API call should be a relative path; an empty value makes `apps/web/lib/api.js` build relative URLs |

`PORT` and cookie-name overrides (`COOKIE_NAME`/`ADMIN_COOKIE_NAME`) don't
apply on Netlify — leave them unset.

## 4. First deploy

Trigger the deploy and watch the build log for:
- `apps/web`'s `npm ci && npm run build` succeeding (this is the Next.js
  build — the `@netlify/plugin-nextjs` plugin handles turning it into
  Netlify's SSR/Edge output, including `apps/web/middleware.js`'s admin-route
  guard).
- `npm ci --prefix ../api` succeeding (installs `apps/api`'s dependencies so
  the functions bundler can trace and bundle them).
- The functions bundling step picking up `apps/api/netlify/functions/api.js`,
  `scheduler.js`, and `drain.js` without missing-module errors.

**If something doesn't line up** (a redirect resolves to the wrong path, the
plugin fights with the `publish` setting, the functions directory isn't
found): `netlify.toml`'s paths were written against Netlify's documented
monorepo conventions but not yet confirmed against a real build log — read
the error, it'll point at exactly which path is wrong, and adjust the
corresponding line in `netlify.toml`.

Once it's live, go back to §3 and set `APP_URL` to the real
`https://your-site.netlify.app` URL, then trigger a redeploy (this value is
read by `apps/api/src/app.js`'s CORS config — harmless if briefly wrong since
everything's same-origin anyway, but worth fixing).

## 5. Seed the Admin account

Netlify has no shell access or one-off job runner, so this one step happens
from your own machine, pointed at the production database:

```bash
cd apps/api
DATABASE_URL="<the same Supabase pooler string>" \
ADMIN_EMAIL="<your admin email>" \
ADMIN_PASSWORD="<a real password>" \
ADMIN_NAME="Admin" \
node scripts/seedAdmin.mjs
```

This is safe to re-run — it upserts by email.

## 6. Smoke test

Walk the whole flow against the live URL:

1. Log in at `/admin/login` with the seeded Admin credentials.
2. Create a realtor (client) via **Add client**.
3. Connect a real Google Sheet (now that `SHEET_FETCHER=http`, this hits the
   real SSRF-guarded fetch path, not local fixtures) and sync it.
4. Create an automation, click **Preview matches** — it should show
   "queued"/"running" briefly (the async runner) and then resolve to real
   stats within a few seconds.
5. Activate it and click **Run now** — confirm a real email arrives via
   Resend (check the inbox on your own Resend account, since
   `onboarding@resend.dev` only delivers there until a domain is verified).
6. Set a cron schedule on an automation and confirm `next_run_at` shows up in
   the UI; you can watch the Netlify Functions log for the `scheduler`
   function firing every minute.

## A note on cost

The async runner design here (queue in Postgres, drained by a **Scheduled
Function** polling every minute, bounded per tick) deliberately avoids
needing Netlify's **Background Functions** (true fire-and-forget, up to 15
minutes) — those require a paid plan. Scheduled Functions and the plain
`api`/`drain` functions here run within Netlify's Free plan limits. Verify
current numbers on Netlify's pricing page before relying on this, since
pricing pages change.
