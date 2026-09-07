# Build progress — Realtor Listing Automation

Tracks phases from `CLAUDE.md` / `claude-code-prompts.md`. A phase is only checked off
once it's implemented AND verified against its acceptance criteria (curl/newman, not
just "code compiles"). `docs/api-guide.md` gets a new section per phase as it lands.

Sequencing note: `CLAUDE.md`'s table doesn't assign specific Next.js pages to phases
3-7 (those are backend/API-only, verified via Postman). Per the "UI ready" goal, the
full frontend (login, signup, dashboard, clients, integrations, automation wizard,
run detail, inbox, public listing/thread pages) is built as **Phase 8**, once every
API it depends on already exists and is proven. Flag me if you wanted UI earlier.

---

## Phase 2 — Auth ✅ DONE
- [x] Realtor model, signup/login/logout/me/profile
- [x] JWT (cookie + Bearer), zod validation, central error handler, rate limiting
- [x] All 7 acceptance criteria verified live against real MongoDB
- [x] Postman collection (`apps/api/postman/auth.postman_collection.json`), 21/21 assertions green
- [x] `docs/api-guide.md` written

## Phase 3 — Clients CRUD ✅ DONE
- [x] `src/models/Client.js` — compound unique `{realtorId, email}`, index `{realtorId, 'preferences.zipCodes'}`
- [x] zod validators, ZIP → `padStart(5,'0')`
- [x] Routes (all scoped by `req.realtorId`): `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`
- [x] Verify: dup email same realtor → 409; same email different realtor → OK; cross-realtor `:id` → 404; zip "7069"→"07069"; DELETE archives (doc still exists); list excludes archived by default
- [x] Postman collection updated
- [x] `docs/api-guide.md` updated

## Phase 4 — Spreadsheet ingestion (public link) ✅ DONE
- [x] `SpreadsheetConnection` model, unique `{realtorId, fileId, gid}`
- [x] URL parser (Google Sheets URL forms) — never `fetch(userInput)` directly, 9 unit tests green (`npm test`)
- [x] SSRF guard: `docs.google.com` (+ `.googleusercontent.com` for redirects) host allowlist, rebuilt export URL, redirect-hop validation, 15s timeout, 10MB cap
- [x] Private-sheet detection: content-type + `<!DOCTYPE` body sniff, not status-code alone
- [x] CSV parser → normalized rows, ZIP padStart, dedupe by email (last wins), errors[] capped at 50, header aliasing (auto-detects common header name variants, no manual column-mapping step required)
- [x] Sync pipeline: upsert `{realtorId, email}`, archive rows missing from sheet, never hard-delete
- [x] Fixtures in `data/fixtures/`: `buyers-clean.csv`, `buyers-messy.csv`, `buyers-empty.csv`, `not-public.html`
- [x] Verify all 6 acceptance items — all pass live against real MongoDB
- [x] Postman + docs updated

Note: `master-plan.md` §4 still describes the old Google OAuth flow — it was never rewritten
when `CLAUDE.md` superseded it. I implemented Phase 4 from the `claude-code-prompts.md`
prompt directly (URL forms, header aliasing, fixture design were my calls, not lifted from
a §4.2-4.9 that doesn't exist in the doc). Flagged here rather than blocking on it.

## Phase 5 — Listing provider ✅ DONE
- [x] `Listing` model (cache), unique `{provider, providerId}`, index `{zip, status}`
- [x] `ListingProvider` interface + `MockListingProvider` (reads `data/listings.json`) + `ZillowProvider` stub
- [x] `NormalizedListing` shape (generic `providerId`/`sqft` names, not Zillow-specific `zpid`/`livingArea`)
- [x] `GET /api/listings?zip=&beds=&maxPrice=` — upserts into cache, idempotent
- [x] Created `data/listings.json` (12 listings across 4 ZIPs, incl. one ZIP with zero `for_sale` matches for Phase 6)
- [x] Verify all 4 acceptance items + 4 contract-test unit tests (`npm test`, 13 total passing)
- [x] Postman + docs updated

## Phase 6 — Matching engine + unit tests ✅ DONE
- [x] `src/services/matching/engine.js` — pure function, no DB/network/mutation
- [x] 32 `node:test` cases (bedroom modes, family-size modes, price cap, empty/no-match, cap slicing, non-mutation, determinism, tied prices) — well above the ~25 target
- [x] `npm test` green (45/45 total across all phases)
- [x] Confirmed the engine file has zero runtime imports (JSDoc `@param {import(...)}` type references only — no executable dependency on `src/models`, `src/db`, or any service)

## Phase 7 — Automation runner + email template + MailDev ✅ DONE
- [x] `Automation`, `AutomationRun`, `Delivery` models (full CRUD + preview/run/runs/deliveries routes)
- [x] `docker-compose.yml` added (mongo+maildev, per spec) — not used locally since this machine has no Docker; ran MailDev via its npm CLI instead (`npm run maildev`, pinned to stable 2.2.1 — the 3.0.0-rc series restructured its API unpredictably)
- [x] Runner orchestration per master-plan §6: unique-ZIP collection, provider fetch+cache reused from Phase 5, per-client try/catch, `excludePreviouslySent` via prior `Delivery` lookup, concurrency-limited sends (hand-rolled limiter, not `p-limit`)
- [x] Email template: hand-rolled HTML tables (no flexbox/grid), realtor header + listing cards + CTA + unsubscribe footer placeholder
- [x] `sendMail()` supports `MAIL_TRANSPORT=smtp|mock` per master-plan §8's explicit MockTransport guidance
- [x] `POST /api/automations/:id/preview` (dry run) and `/run`, plus `GET .../runs`, `GET /api/runs/:runId`, `GET /api/deliveries/:id/html`
- [x] Verified live: preview shows correct per-client match counts (0 sent, matched client correctly identified); real run lands in MailDev (confirmed via its REST API); one bad send (`MAIL_TRANSPORT=mock` + a deliberately invalid email) → run status `partial`, other client still sent, run didn't abort

Deferred (noted, not blocking): automation `autoSync` (spreadsheet re-sync before a run), and license-verification send-gating (master-plan calls this optional — "block *sending* on it **if you want**"). The "More Info" CTA links straight to the mock `listingUrl` for now; the signed-token `/l/[token]` conversation flow is Phase 9's job.

## Phase 8 — Full Next.js UI ✅ DONE
- [x] `apps/web` scaffold (App Router, Tailwind, plain JS — no TypeScript per `CLAUDE.md`)
- [x] Hand-built UI primitives instead of the shadcn CLI (Button/Input/Card/Badge/Modal/PageHeader) — avoids ~6 new Radix/CVA/etc. dependencies while keeping the same visual quality; easy to swap for literal shadcn components later if wanted
- [x] Design system: cool sage-paper background, deep verdigris accent, Zilla Slab (headings) + Inter (UI) + IBM Plex Mono (data/numbers) — deliberately not the cream+serif+terracotta or dark+neon "AI SaaS" defaults
- [x] `/login`, `/signup`, `/dashboard` (stat cards + recent runs table)
- [x] `/clients` (table, search, archive toggle, add/edit modal)
- [x] `/integrations` (paste-a-sheet-link → preview → connect → sync, with per-connection sync stats)
- [x] `/automations` list, `/automations/new` (real 4-step wizard: creates a draft automation at step 1 and PATCHes it through each step; step 3's "Preview matches" and step 4's "Refresh preview" call the real `/preview` endpoint — no fake data), `/automations/[id]` (run history + Run Preview/Run Now), `/automations/[id]/runs/[runId]` (per-client deliveries + real email viewer via iframe)
- [x] `middleware.js` route guard (cookie presence check; real verification stays server-side) — works because the cookie is host-scoped to `localhost` and both apps run there
- [x] `lib/api.js` fetch wrapper (`credentials: 'include'`), `GET /api/runs` added to the API to power the dashboard's cross-automation run list
- [x] **Verified in a real headless browser** (Playwright, installed as a devDependency — also needed for Phase 10's E2E anyway): scripted the full flow — login → dashboard → add a client → integrations → the entire 4-step wizard including both live previews → activate → run for real → open the run detail → view the actual delivered email in the modal. Zero console/page errors, all assertions passed. Screenshots reviewed by hand.
- [x] Two real bugs found and fixed by this testing, not left in the shipped app:
  1. A dashboard stat's zero rendered visually identical to the letter "O" in the slab-serif font — moved numeric stat values to the monospace face.
  2. `GET /api/auth/me` (fired on every page load for the session check) shared the strict 20-req/15-min auth rate limiter with login/signup, so normal browsing could lock a user out. Scoped the strict limiter to just `/signup` and `/login`.

Not built (out of scope for this phase, called out in the master plan as later work): Google Drive OAuth (superseded — public-link paste is the real flow), a manual column-mapping UI step (the backend auto-detects common header names, so it wasn't needed for the flows built so far), `/inbox` (Phase 9).

## Phase 9 — Tokens, conversations, inbox ✅ DONE
- [x] Signed link tokens (`jwt.sign({d,c,l,r}, LINK_SECRET, {expiresIn:'90d'})`) — new `LINK_SECRET` env var, required at startup like `JWT_SECRET`
- [x] Runner restructured so the `Delivery` is created *before* rendering the email (tokens embed the real delivery/listing `_id`s, so they can't be minted until the Delivery exists) — the "More Info" link is now a real signed `/l/[token]` URL, not the Phase 7 placeholder mock `listingUrl`
- [x] `Conversation`, `Message`, `LinkEvent` models
- [x] Public routes (no auth): `GET /api/public/listing/:token`, `POST /api/public/inquiry/:token`, `GET /api/public/thread/:clientToken`, `POST /api/public/thread/:clientToken/messages`
- [x] Authenticated inbox routes: `GET/PATCH /api/conversations`, `GET /api/conversations/:id`, `POST /api/conversations/:id/messages`
- [x] Realtor gets a "new inquiry" email, client gets a confirmation email with their `/t/<clientAccessToken>` thread link, each reply on either side emails the other party
- [x] `/l/[token]` and `/t/[token]` public pages (outside the authenticated app shell, no login needed), `/inbox` UI (two-pane, added to the sidebar)
- [x] **Verified end-to-end with the real link, not a stub**: ran a real automation → pulled the actual delivered email out of MailDev's REST API → regex-extracted the real signed URL from its HTML → opened it in a real (Playwright) browser → submitted an inquiry → confirmed it appeared in the realtor's `/inbox` → replied → confirmed the client's `/t/[token]` page (opened via the link from the confirmation-email flow) showed the reply → client replied again. Zero console errors, 9/9 checks passed.

Unsubscribe (`GET /api/public/unsubscribe/:token`) stays deferred to Phase 10 as originally planned.

## Phase 10 — Scheduler, unsubscribe, E2E ✅ DONE
- [x] `node-cron` scheduler (`src/jobs/scheduler.js`) — loads active `schedule.mode:'cron'` automations on boot, and stays in sync on every create/update/delete via an in-memory registry (not just boot-time)
- [x] Cron expressions validated at the API boundary with `node-cron`'s own `cron.validate()` — same library that executes them, so validation can't drift from behavior
- [x] Unsubscribe: new `signUnsubscribeToken`/`verifyUnsubscribeToken`, `GET /api/public/unsubscribe/:token` sets `subscribed:false`, the email template's footer link is now real (was a `#` placeholder since Phase 7)
- [x] `/unsubscribe/[token]` public confirmation page
- [x] Formal Playwright E2E suite (`apps/web/e2e/full-flow.spec.js`, `npm run test:e2e`) covering the exact master-plan §12 path: signup → connect + sync a spreadsheet → create an automation → preview (live match count) → activate → run for real → pull the actual delivered email out of MailDev's REST API → click the real signed link → submit an inquiry → realtor sees it in `/inbox` and replies → client sees the reply in `/t/[token]`. Green, and stable across repeat runs.
- [x] Verified live: cron validation rejects garbage (400), an activated cron automation is picked up by the scheduler (confirmed via boot log showing the count), an emailed unsubscribe link actually flips `subscribed:false` and the client is excluded from the very next run

Column mapping doesn't appear in the E2E path because the sync backend auto-detects
common header names (a Phase 4 design choice, not a gap) — there's nothing to map.

---

## All 10 phases complete

Backend: 45 unit tests green (`cd apps/api && npm test`), 61 Postman assertions
green (`apps/api/postman/auth.postman_collection.json`, or the newman command
in `docs/api-guide.md`). Frontend: full Playwright E2E green
(`cd apps/web && npm run test:e2e`), plus two ad-hoc verification scripts kept
for quick manual re-checks (`apps/web/scripts/verify-ui.mjs`,
`apps/web/scripts/verify-conversation.mjs`).

**What's deliberately not built**, all called out as such earlier in this file
rather than silently skipped: Google Drive OAuth (superseded by public-link
paste), a manual column-mapping UI (backend auto-detects headers), automation
`autoSync` before a run, license-verification send-gating (master-plan marks
this optional), and open-tracking pixels on emails (only link clicks are
tracked).

---

## Admin-managed model (post-launch pivot)

The product moved from self-serve SaaS (realtors sign themselves up) to an
admin-operated model: Admin onboards every realtor manually and manages them
from one panel. This was a deliberate, explicit product decision, not scope
creep — confirmed via `AskUserQuestion` before any code changed (recorded
below), following the same "ask before changing a schema a previous phase
already wrote to" rule this file has followed throughout.

**Confirmed decisions:**
- No realtor login at all — Admin manages everything, including what used to
  be the realtor-facing dashboard/automations UI.
- "Usage limit" and "notification" settings are stored fields on the Realtor
  profile, **not enforced or wired to anything yet** — a placeholder for a
  future pass once their exact semantics are decided.
- All seven new buyer-preference dimensions (bathrooms, basement, home type,
  parking, min sqft, min year built, buy/rent) became live matching-engine
  filters immediately, not deferred.
- The imported/manually-added people, previously called "Client" throughout
  the codebase, were renamed to **"Buyer"** end-to-end — model, collection,
  routes, controller, validators, tests, Postman, web pages. "Client" now
  means the realtor (the business's own customer), matching how the person
  running this system actually talks about the product.
- The email's per-listing CTA now links directly to the listing's real Zillow
  URL instead of an in-app page.

**What that CTA change took down with it:** the Phase 9 conversation/inquiry/
inbox feature had exactly one entry point — a buyer clicking "More Info" in an
email. With that link now pointing straight at Zillow, the feature had no way
to ever be reached, so it was **removed outright** rather than left dormant:
`Conversation`/`Message`/`LinkEvent` models, the conversations controller/
routes, the public listing/inquiry/thread endpoints and pages (`/l/:token`,
`/t/:token`), the realtor `/inbox` page, and the `signListingToken`/
`buildListingUrl`/`buildThreadUrl` token helpers. `signUnsubscribeToken` and
the unsubscribe flow are unrelated and untouched.

**Backend:**
- [x] New `Admin` model + JWT/cookie auth (`admin_token`, separate cookie name
  from the old realtor one) mirroring the existing auth pattern exactly —
  `POST /api/admin/auth/login`, `/logout`, `GET /me`. No admin signup route;
  `apps/api/scripts/seedAdmin.mjs` creates the first (and any later) admin.
- [x] Realtor self-serve `POST /api/auth/signup`/`/login` removed entirely;
  `Realtor.passwordHash` made optional rather than dropped (no migration
  needed on existing docs). New `POST /api/admin/clients` repurposes the old
  signup fields *minus password*, plus an optional `sheetUrl` that connects a
  spreadsheet in the same request.
- [x] **Zero changes needed to any existing realtor-scoped controller.** A new
  `resolveRealtorParam` middleware reads `:realtorId` from the route and sets
  `req.realtor`/`req.realtorId` — the exact same contract the old `requireAuth`
  provided from a realtor's own JWT. Every controller (buyers, spreadsheets,
  listings, automations, runs, deliveries) is mounted under
  `/api/admin/clients/:realtorId/...` with `requireAdminAuth` +
  `resolveRealtorParam` and needed no internal changes.
- [x] `Client` → `Buyer` rename across the model (`preferences.zipCodes` now
  supports multiple ZIPs per buyer), controller, routes, validators.
  `Delivery.clientId` → `buyerId`, `Automation.audience.type` enum
  `clientIds` → `buyerIds`, `matchRules.maxListingsPerClient` →
  `maxListingsPerBuyer`, `AutomationRun.stats.clientsProcessed/clientsMatched`
  → `buyersProcessed/buyersMatched` — **existing documents in the dev database
  were migrated in place** (collection rename via `renameCollection`, field
  renames via `$rename`/`updateMany`) rather than silently left stale.
- [x] CSV parser rewritten for the 16-column schema (`NAME`/`EMAIL`/`PHONE`/
  `INT_ZIP`/`INT_FAMILY`/`INT_BEDROOM`/`INT_BATHROOMS`/`INT_BASEMENT`/
  `INT_HOME_TYPE`/`INT_PARKING`/`INT_SQUARE_FEET`/`INT_YEAR_BUILT`/
  `INT_LISTING_TYPE`/`EMAIL_OPTIN`/`SMS_OPTIN`/`WHATSAPP_OPTIN`): name/email/
  phone/at-least-one-ZIP are now required (previously only email+ZIP); ZIP
  cells support multiple comma/semicolon/space-separated values; a tri-state
  boolean parser distinguishes "no preference" (blank) from an explicit
  yes/no for basement/parking; `EMAIL_OPTIN` maps to the existing `subscribed`
  field rather than a new one; trailing blank header columns (present in the
  real sample sheet) no longer crash `csv-parse`.
- [x] Matching engine (`services/matching/engine.js`) gained seven new filter
  stages, every one skipped when the buyer has no preference set — the exact
  mechanism that makes "a buyer with nothing set gets everything in their
  ZIP" true with no special-case code. `basement`/`parking` are new
  `Listing` fields; the real Bronx dataset has zero data for either (and for
  `yearBuilt`), so buyers who set those three preferences will match nothing
  against it until a richer listing source exists — documented as a known
  data-completeness limit, not a bug. ~28 new unit tests added (bathrooms
  mirrors the existing bedrooms cluster; basement/home type/parking/min
  sqft/min year built/listing type each get a focused cluster) — 55 total in
  `matchingEngine.test.js`. A new `buyersCsvParser.test.js` covers the
  trickiest new parsing logic (multi-ZIP splitting, required-field
  validation, tri-state booleans) — 74 tests green overall.
- [x] Email template (`listingDigest.js`) now shows the full picture per
  listing (sqft, lot size, year built, property type, description) and the
  CTA links straight to `listing.listingUrl`.
- [x] New `GET /api/admin/clients/:realtorId/overview` aggregates buyer/
  automation/run counts from existing collections — no new tracking fields
  needed.

**Frontend:** entire `(auth)`/`(app)` realtor-facing surface removed and
rebuilt as `app/admin/`: `/admin/login`, `/admin/clients` (list + onboarding
modal built from the old signup form minus password), and
`/admin/clients/[realtorId]` with an Overview/Buyers/Automations/Settings tab
layout — Integrations folded into Settings, Inbox dropped entirely. Every
page that used to call a bare `/api/...` path now goes through a
`scopedApi(realtorId)` helper prefixing `/api/admin/clients/:realtorId`; the
automation wizard, detail, and run-detail pages are otherwise the same logic
as before, just re-scoped and renamed (buyerIds, maxListingsPerBuyer,
buyersMatched/buyersProcessed).

**Verified live**, not just written:
- Admin login → onboard a client with a real spreadsheet link in one request
  → sync populated buyers with every one of the 16 fields parsed correctly
  (multi-ZIP splitting, tri-state booleans, home-type normalization, opt-ins)
  → automation with the new bathrooms rule → real run against the real
  328-listing Bronx dataset → email in MailDev with full listing details and
  a working `zillow.com` link → confirmed re-running the same automation
  sends zero duplicate listings (the pre-existing exclusion logic, unaffected
  by the new dimensions).
- A real bug was caught and fixed mid-migration: a buyer preference
  (`INT_LISTING_TYPE`) was briefly parsed with the wrong boolean helper
  before being corrected to check for the literal word "rent".
- Full Playwright pass through the actual admin UI (`npm test`-style ad-hoc
  script, screenshots reviewed): onboard → add a buyer with the full field
  set manually → connect + sync a real sheet from Settings → build an
  automation → live match-count preview → email preview showing the Zillow
  CTA → activate → run for real. Zero console errors.
- `npm test`: 74/74 green. Postman and the Playwright E2E suite (`full-flow.spec.js`)
  still need a full rewrite for the new admin-nested flow — the old versions
  assume realtor self-serve auth and the removed conversation feature, so
  they're stale until that rewrite happens (tracked as follow-up, not done
  yet).

**Not built** (same "stored placeholder, not wired" treatment as the earlier
phases' deferred items): `usageLimit` and `notifications.enabled` enforcement,
SMS/WhatsApp sending (the opt-in flags are captured and stored only).

---

## Deploy-readiness pass

Triggered by a full UX/architecture review of the running app (live walkthrough +
code read of every screen and controller) that surfaced a real gap between what the
product claims to do and what it actually did: automations had no way to schedule
themselves, and email only ever reached MailDev, never a real inbox. Everything below
was fixed/added in one pass; CSV upload (an alternative to pasting a Google Sheet
link) was the one reviewed item deliberately dropped — it would need a new `multer`
dependency for a nice-to-have.

**Real email — Resend, no new dependency.** Resend exposes a standard SMTP relay, so
`services/email/transport.js` needed a config fix, not a new integration: it
previously hardcoded `secure:false, ignoreTLS:true` and never sent `auth` at all,
which only ever worked against MailDev. Now `secure` is derived from the port and
`auth` is sent whenever `SMTP_USER` is set, so the same `MAIL_TRANSPORT=smtp` switch
reaches either MailDev (local) or Resend (real), depending on `.env`. Verified: a
real automation run's email landed in a real inbox via Resend, not just MailDev's UI.

**Automations can now actually schedule themselves** — the `Automation.schedule`
field and the cron engine (`jobs/scheduler.js`) already existed and worked, but no
screen ever set them; every send required a manual "Run now" click. Added a Schedule
step to the automation wizard (plain-language daily/weekly picker, or an advanced
custom-cron field) plus the same editor on the automation detail page, and a
`nextRunAt` computed and persisted on every schedule change (`utils/cronNext.js`,
no new dependency — brute-forces forward using `Intl.DateTimeFormat` so it's correct
in the schedule's own timezone, not the server's). A real timezone bug was caught and
fixed here mid-build: the first version ignored the configured timezone entirely and
only looked right because the server's local zone happened to match the test value.

**Fixed a real, live bug**: the unsubscribe link fired on page load via a GET with a
side effect — email-client link scanners prefetch links automatically, which would
silently unsubscribe buyers who never clicked anything. Split into a read-only `GET`
(shows who's about to be unsubscribed) and a `POST` that only fires on an explicit
"Yes, unsubscribe me" click.

**Mobile was broken, not just cramped** — the fixed sidebar ate ~60% of a 390px
viewport with no collapse, and table columns were pushed off-screen. `AdminShell`
now collapses to a hamburger-triggered drawer below `md:`, and every data table sits
in its own `overflow-x-auto` container. Verified: no page-level horizontal scroll
(`document.body.scrollWidth === clientWidth`) at 390px on every screen.

**Everything else from the review**, verified live via curl and Playwright, not just
written: pagination (`page`/`limit`/`pagination` envelope) added to the realtor and
automation lists to match what buyers already had, plus "Load more" controls;
destructive actions (archive a buyer, delete an automation) now use a styled
`ConfirmModal` instead of `window.confirm`; a cross-client admin overview
(`GET /api/admin/overview`) with a "needs attention" feed for failed runs and errored
syncs; retry for a failed delivery and a "send test to myself" button in the wizard
(both reuse a delivery's already-rendered content — no re-render, no runner
changes); per-buyer send history; an admin password-change endpoint; a client
status selector (suspend/reactivate) on Settings; the previously-hardcoded raw match
rule enums (`atLeast beds`) replaced with plain-language descriptions; and an atomic
run-concurrency guard — a partial unique index (`{automationId, status:'running'}`)
rather than a check-then-act read, since a plain `findOne` guard was proven to race
under two near-simultaneous requests during verification.

**Not built / known limitations**: Resend's `onboarding@resend.dev` sending address
only delivers to the Resend account's own email until a real domain is verified —
fine for confirming the pipe works, not for real buyer sends yet.

## Database migration: MongoDB → Postgres/Supabase (in progress)

A deliberate, explicit decision to move off MongoDB (superseding CLAUDE.md's
current Stack table, not yet updated to match) onto Supabase Postgres, plus a
Netlify Functions deploy for the API. Scoped into three phases; only #1 is
done:

1. **Done, code-complete, not yet live-verified**: full schema
   (`apps/api/src/db/schema.sql`), a `pg`-based repository layer
   (`apps/api/src/repositories/*.repo.js`) replacing every Mongoose model
   one-for-one (same `_id`/camelCase shape returned, so no frontend or
   controller-logic changes needed), every controller/service/job rewired to
   use it. Blocked on a real `DATABASE_URL` for live verification (schema
   apply, full curl/Playwright pass, the run-concurrency and duplicate-email
   regressions, multi-tenant isolation).
2. **Not started**: make the automation runner async (`POST .../run` returns
   immediately instead of awaiting the full send loop) — needed regardless of
   hosting, and before #3 specifically (serverless execution-time limits).
3. **Not started**: convert the Express API to Netlify Functions; replace the
   in-process `node-cron` scheduler (a `Map` of live timers, only valid in one
   long-lived process) with a Netlify Scheduled Function that polls for due
   automations; fix cross-origin cookie/CORS behavior for the new topology.

A self-review of phase 1 (done before any live DB was available) already
caught and fixed two real bugs: a realtor `password_hash` column that would
have appeared (always `null`, but present) in every realtor API response, and
a `bathrooms numeric` column that `node-postgres` would have silently
returned as a string instead of a number. Also fixed in the same pass:
`app.js` had no `trust proxy` setting (breaks per-IP rate limiting behind any
real host's reverse proxy), and the email template had two low-severity
HTML-injection gaps (an unescaped admin-set accent color in a CSS attribute,
and an unescaped listing property-type field).

## Cleanup: removed the stale Postman collection and Playwright E2E suite

Both `apps/api/postman/auth.postman_collection.json` and
`apps/web/e2e/full-flow.spec.js` predated the Admin-managed model — every
request/step in them targeted the old self-serve signup flow and the deleted
inbox/conversation feature, none of which exist anymore. Neither had been
updated since, so neither was catching anything real. Deleted rather than
left as misleading dead weight; `docs/api-guide.md` §11 updated to match.
Replacing them with suites that exercise the current app is future work, not
done here.
