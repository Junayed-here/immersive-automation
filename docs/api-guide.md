# API Guide — what you can do right now

Reflects the **admin-managed model**: a single Admin logs in and manages every realtor
("Client") from one panel — realtors never log in themselves. See
`docs/build-progress.md` for the detailed build log, including what changed from the
original self-serve design and why.

## Using the web app

Everything below this point is the raw API reference. If you'd rather click through
a real UI instead of curl/Postman:

1. `cd apps/api && npm run dev` (API on `:4000`)
2. `cd apps/api && npm run maildev` (email inbox at `http://localhost:1080`)
3. `cd apps/web && npm install && npm run dev` (web app on `http://localhost:3000`)
4. Open `http://localhost:3000` — you'll land on `/admin/login`. Sign in with the seeded
   admin account (see `apps/api/.env`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`).

Pages: `/admin/clients` (list + "Onboard client"), and per-client
`/admin/clients/[realtorId]` with tabs — **Overview** (analytics), **Buyers** (the
imported/manually-added people), **Automations** (list, `new` wizard, detail, run
detail with a real email viewer), **Settings** (profile fields + spreadsheet link).
Every action on these pages calls the real API — nothing is mocked.

Base URL for every request below: `http://localhost:4000`

**Response envelope** — every endpoint except `/health` replies in one of these two shapes:
```json
// success
{ "success": true, "message": "...", "data": { } }

// error
{ "success": false, "error": { "message": "...", "details": [ { "field": "email", "message": "..." } ] } }
```

---

## 0. Before you start

1. MongoDB is already running locally (Homebrew service `mongodb-community@7.0`, `mongodb://localhost:27017/listing_automation`).
2. From `apps/api/`: `npm run dev` — logs the Mongo connection and the port.
3. There's exactly one way to create an Admin account — the seed script:
   ```
   cd apps/api && node scripts/seedAdmin.mjs
   ```
   It reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME` from `.env` (or inline env vars).
   Safe to re-run — upserts by email.

---

## 1. Check the server is up

```
GET /health
```
Response:
```json
{ "ok": true }
```

---

## 2. Admin login

```
POST /api/admin/auth/login
Content-Type: application/json
```
```json
{ "email": "admin@example.com", "password": "change_me_please" }
```
Success — `200`, sets an httpOnly cookie (`admin_token`, separate from the old realtor
cookie name so the two can never collide) and returns `{ token, admin }`. Use *either*
the cookie or `Authorization: Bearer <token>` from here on.

```
GET  /api/admin/auth/me       → { admin }  (401 if not signed in)
POST /api/admin/auth/logout   → clears the cookie
```

There is no admin signup route and no realtor login at all — realtors are onboarded
by Admin (below) and interact with buyers entirely through emails Admin's automations
send; they never sign into this app.

---

## 3. Onboard a client (realtor)

```
POST /api/admin/clients
Authorization: Bearer <admin token>
```
```json
{
  "firstName": "Sarah",
  "lastName": "Chen",
  "email": "sarah.chen@example.com",
  "phone": "7185551001",
  "license": { "number": "NY-RE-4471982", "state": "NY" },
  "brokerage": { "name": "Elmhurst Realty Group", "address": "85-01 Broadway, Elmhurst, NY 11373" },
  "sheetUrl": "https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
}
```
`201` with `{ realtor, connection }`. No password field — this realtor can never log
in. `sheetUrl` is optional; if given, a `SpreadsheetConnection` is created in the same
request (not synced yet — sync it explicitly, see §5).

```
GET   /api/admin/clients?search=&status=&page=&limit=   → list realtors (paginated, default limit 20, max 100)
GET   /api/admin/clients/:realtorId                      → one realtor's profile
PATCH /api/admin/clients/:realtorId                       → update profile/settings (see below)
GET   /api/admin/overview                                 → aggregate stats across every realtor (see §10)
```
`PATCH` accepts `firstName`, `lastName`, `email`, `phone`, `license`, `brokerage`
(including `brokerage.phone`), `profile`, `emailSettings`, `usageLimit` (a number,
**not enforced yet** — stored for future use), `notifications.enabled` (a boolean,
also **not enforced yet**), and `status` (`"pending"|"active"|"suspended"` — a
suspended client is just a stored flag today, nothing currently blocks their
automations from running).

List endpoints that support `page`/`limit` (buyers, automations, realtors) all return
the same `pagination: { page, limit, total, pages }` envelope alongside the array.

Every route below this point is nested under one specific client:
`/api/admin/clients/:realtorId/...` — Admin acts "as" that realtor by id, there's no
separate realtor session to scope by.

---

## 4. Buyers

The people imported from a spreadsheet (or added manually) who receive listing
digest emails. Renamed from "clients" to "buyers" to match the business's own
vocabulary — the realtor is the "client," the buyer is their customer.

```
POST   /api/admin/clients/:realtorId/buyers
GET    /api/admin/clients/:realtorId/buyers?search=&zip=&status=&page=&limit=
GET    /api/admin/clients/:realtorId/buyers/:id
GET    /api/admin/clients/:realtorId/buyers/:id/deliveries   # this buyer's send history
GET    /api/admin/clients/:realtorId/buyers/:id/analytics    # totals, skip-reason breakdown, 30-day sent/skipped/failed by day
PATCH  /api/admin/clients/:realtorId/buyers/:id
DELETE /api/admin/clients/:realtorId/buyers/:id     (archives, never hard-deletes)
```
Create body — `name`, `email`, and `phone` are required; everything in `preferences`
is an optional filter (a buyer with none of them set receives every for-sale listing
in their ZIP(s)):
```json
{
  "name": "Alex Buyer",
  "email": "alex.buyer@example.com",
  "phone": "7185550111",
  "preferences": {
    "zipCodes": ["10465", "10462"],
    "bedrooms": 3, "bathrooms": 2, "familySize": 4,
    "basement": true, "parking": false,
    "homeType": ["SINGLE_FAMILY", "CONDO"],
    "minSqft": 1000, "minYearBuilt": 1990,
    "listingType": "buy"
  },
  "communicationPrefs": { "smsOptIn": false, "whatsappOptIn": false }
}
```
`zipCodes` normalizes each entry to 5 digits. `basement`/`parking` are tri-state —
omit them entirely for "no preference" (matches everything either way); set `true`/
`false` for an exact requirement. `homeType` values match `Listing.propertyType`
(`SINGLE_FAMILY`, `CONDO`, `MULTI_FAMILY`, `TOWNHOUSE`, `LOT`, `MANUFACTURED`).
`listingType` is `"buy"` (default) or `"rent"` — there's no rental inventory yet, so
`"rent"` buyers never match anything (an honest limitation, not a bug).

`smsOptIn`/`whatsappOptIn` are stored only — no SMS/WhatsApp sending is built.
Email opt-out/opt-in lives on the existing `subscribed` field (see §7's unsubscribe
link), not a separate flag.

---

## 5. Spreadsheet ingestion

Realtors hand Admin a public Google Sheet link (Anyone-with-the-link view access)
rather than any OAuth flow. All routes are nested under a client.

**Local testing without a real Google Sheet:** set `SHEET_FETCHER=local` in `.env`
and use a URL like `https://docs.google.com/spreadsheets/d/<fixture-name>/edit#gid=0`,
where `<fixture-name>` is a basename in `data/fixtures/`. Set `SHEET_FETCHER=http` to
fetch a real published sheet instead.

Spreadsheet columns recognized (header names are auto-detected — common variants and
a keyword fallback both work, so exact capitalization/wording doesn't matter):

| Column | Maps to |
|---|---|
| `NAME`, `EMAIL`, `PHONE` | required on every row |
| `INT_ZIP` | `preferences.zipCodes` — supports multiple ZIPs in one cell (comma/semicolon/space separated), at least one required |
| `INT_FAMILY`, `INT_BEDROOM`, `INT_BATHROOMS` | `preferences.familySize`/`bedrooms`/`bathrooms` |
| `INT_BASEMENT`, `INT_PARKING` | `preferences.basement`/`parking` — Yes/No/blank |
| `INT_HOME_TYPE` | `preferences.homeType` — free text, comma-separated, normalized |
| `INT_SQUARE_FEET`, `INT_YEAR_BUILT` | `preferences.minSqft`/`minYearBuilt` |
| `INT_LISTING_TYPE` | `preferences.listingType` — "Rent" or anything else (defaults to "buy") |
| `EMAIL_OPTIN` | the buyer's `subscribed` field (blank defaults to opted-in) |
| `SMS_OPTIN`, `WHATSAPP_OPTIN` | `communicationPrefs` — stored only |

```
POST /api/admin/clients/:realtorId/spreadsheets/preview     { "url": "..." }   → { headers, sampleRows } - writes nothing
POST /api/admin/clients/:realtorId/spreadsheets/connect     { "url": "..." }   → 201, the SpreadsheetConnection
POST /api/admin/clients/:realtorId/spreadsheets/:id/sync                      → { stats }
GET  /api/admin/clients/:realtorId/spreadsheets
```
Sync stats: `{ rowsRead, created, updated, archived, duplicates, errors }`.
- Bad rows (missing name/email/phone/ZIP) never abort the sync — they land in `errors[]` (capped at 50).
- Duplicate emails in the sheet collapse to one buyer (last row wins).
- Running sync again on an unchanged sheet creates zero new buyers (idempotent).
- A buyer who disappears from the sheet gets archived (`status: 'archived'`), never hard-deleted.

**Errors:** a non-`docs.google.com` URL → `400 INVALID_HOST` (rejected before any
network call); a private (non-public) sheet → `422 NOT_PUBLIC`.

---

## 6. Listings

Provider-backed and cached — `MOCK_LISTINGS_PATH` in `.env` points at either the
curated 12-listing fixture (`data/listings.json`, what the unit test suite expects)
or the 328-listing real Bronx dataset (`data/listings-real.json`, for manual testing).
Don't run `npm test` while pointed at the real dataset — the exact counts it asserts
on won't match (use the inline env var override shown in §11 instead).

```
GET /api/admin/clients/:realtorId/listings?zip=10465&beds=3&maxPrice=500000
```
`zip` is required. `beds`/`maxPrice` are optional filters. Only `status: "for_sale"`
listings are ever returned. Every call upserts results into the `listings` collection.

---

## 7. Automations, runs, and deliveries

**Local email testing:** run `npm run maildev` alongside `npm run dev` — SMTP catcher
on `:1025`, web inbox at `http://localhost:1080`. Set `MAIL_TRANSPORT=mock` to push
sends into an in-memory array instead (used by tests). **Real delivery:** point
`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` at Resend's SMTP relay (see the
commented block in `.env.example`) — same `nodemailer` transport either way, just a
different destination. Until a sending domain is verified in Resend,
`MAIL_FROM` must stay `onboarding@resend.dev`, which Resend restricts to delivering
only to the email on your own Resend account.

```
POST /api/admin/clients/:realtorId/automations
```
```json
{ "name": "Weekly Bronx Digest", "audience": { "type": "all" } }
```
`201`, status `"draft"`. `audience.type` is `"all"`, `"zipList"` (`value: [...]`), or
`"buyerIds"` (`value: [...]`). `matchRules` defaults: `bedrooms`/`bathrooms: "atLeast"`,
family size enabled (`derivedBedrooms`), `maxListingsPerBuyer: 8`,
`excludePreviouslySent: true`. Every other new preference dimension (basement, home
type, parking, min sqft, min year built, listing type) is applied automatically
whenever a buyer has that preference set — there's no separate automation-level
toggle for those, only for bedrooms/bathrooms/family size/max price/cap.

```
GET    /api/admin/clients/:realtorId/automations?page=&limit=
DELETE /api/admin/clients/:realtorId/automations/:id            # hard-deletes the automation; past runs/deliveries stay for reference
POST   /api/admin/clients/:realtorId/automations/:id/preview     # dry run, sends nothing
PATCH  /api/admin/clients/:realtorId/automations/:id            { "status": "active" }
POST   /api/admin/clients/:realtorId/automations/:id/run         # must be active
GET    /api/admin/clients/:realtorId/automations/:id/runs
GET    /api/admin/clients/:realtorId/runs/:runId                 # run + deliveries (buyer name/email populated)
GET    /api/admin/clients/:realtorId/deliveries/:id/html         # exact rendered subject + HTML
POST   /api/admin/clients/:realtorId/deliveries/:id/retry        # re-sends a failed delivery's already-rendered content
POST   /api/admin/clients/:realtorId/deliveries/:id/send-test    { "to": "you@example.com" }  # side-channel test send, doesn't touch the delivery's own status
```
Run stats use `buyersProcessed`/`buyersMatched` (renamed from `clientsProcessed`/
`clientsMatched`). One buyer's send failing never aborts the others — the run
finishes `"partial"` and each buyer's outcome is visible on its `Delivery`. Starting
a run while one is already `"running"` for that automation is rejected with `409
RUN_IN_PROGRESS` (enforced by a partial unique index, not just an app-level check —
safe against two requests landing at the same instant).

**Scheduling** — an automation only sends by itself if `schedule.mode` is `"cron"`
*and* `status` is `"active"`; otherwise it only ever runs when something calls
`POST .../run` (manually, from the wizard's schedule step, or via Postman):
```json
{ "schedule": { "mode": "cron", "cron": "0 9 * * 1", "timezone": "America/New_York" } }
```
Standard 5-field cron syntax; a bad expression is rejected with `400` before saving.
The scheduler re-syncs on every automation create/update/delete — no restart needed.
`nextRunAt` on the automation doc is computed and persisted whenever the schedule
changes (and again right after each scheduled fire) — it's evaluated in the
schedule's own `timezone`, not the server's local one, using `Intl.DateTimeFormat`
rather than a parsing dependency (see `utils/cronNext.js`).

**The email itself**: each listing card shows the full picture — photo, address,
price, beds/baths/sqft/lot size/year built/property type, description — and its
button links **directly to the listing's real Zillow page** (`listingUrl`), not an
in-app page. There's no "message the realtor" flow anymore (see `docs/build-progress.md`
for why); a buyer who wants more info goes straight to Zillow.

**Don't resend the same listing twice**: `matchRules.excludePreviouslySent` (default
`true`) checks every past `sent` Delivery for that automation+buyer and excludes
those listings before matching runs again — already covered by the original build,
unaffected by any of the new preference dimensions.

---

## 8. Unsubscribe

Every sent email's footer has a real, working "Unsubscribe" link. The GET is
read-only on purpose (email-client link scanners prefetch links automatically — a
GET with a side effect would silently unsubscribe buyers who never clicked
anything):
```
GET  /api/public/unsubscribe/:token     (no auth) → { email, alreadyUnsubscribed } - does NOT unsubscribe
POST /api/public/unsubscribe/:token     (no auth) → { email } - actually sets subscribed: false
```
The web page at `/unsubscribe/:token` calls the `GET` to show who's about to be
unsubscribed, then only calls the `POST` once the buyer clicks "Yes, unsubscribe me."
Unsubscribing excludes that buyer from every future run's audience entirely, not
just skipped-and-logged.

---

## 10. Admin account

```
PATCH /api/admin/auth/password    { "currentPassword": "...", "newPassword": "..." }
```
The only way to change the seeded admin's password without re-running
`scripts/seedAdmin.mjs`. Rate-limited the same as login. `newPassword` must be at
least 8 characters.

`GET /api/admin/overview` (§3) is the one intentionally cross-tenant read in the
system — buyer/automation/email totals across every realtor, a combined recent-runs
feed, a "needs attention" list (automations whose last run was `failed`/`partial`,
spreadsheets whose last sync errored), a 30-day `runs.sentOverTime` (daily
sent/skipped/failed across every client), and `byRealtor` (emails sent per client,
for a comparison chart). Every other endpoint stays scoped to a single `:realtorId`
— the per-realtor `GET .../overview` (§3) has the equivalent
`runs.sentOverTime`/`buyers.growthOverTime`/`automations.breakdown` fields, scoped to
that one client. The admin panel (`/admin/clients` and each client's Overview tab)
renders these as charts via `recharts`.

---

## 11. Running the test suite

```
cd apps/api && SHEET_FETCHER=local MOCK_LISTINGS_PATH=../../data/listings.json npm test
```
The inline env vars override whatever `.env` is currently set to for manual testing
(real Google Sheets / real listing data), without needing to edit and restore the
file. This is currently the only automated suite — it covers the matching engine,
CSV/URL parsing, and the mock listing provider (all pure functions).

The Postman collection and Playwright E2E suite that once lived at
`apps/api/postman/` and `apps/web/e2e/` were removed — both predated the
Admin-managed model (self-serve realtor signup, `/inbox`, etc., see "Post-launch:
Admin-managed model" in `CLAUDE.md`) and every request/step in them targeted
routes or flows that no longer exist. Neither has been rebuilt against the
current app yet.

---

## Sample dataset already seeded

One admin account, seeded via `node scripts/seedAdmin.mjs` (credentials in
`apps/api/.env` — `ADMIN_EMAIL`/`ADMIN_PASSWORD`). Two realtor ("client") accounts
already exist under it:

| Client | Brokerage |
|---|---|
| Sarah Chen (`sarah.chen@example.com`) | Elmhurst Realty Group (Queens/Nassau) |
| Mike Rodriguez (`mike.rodriguez@example.com`) | Manhattan Prime Properties |

Neither has a password — Admin manages both from `/admin/clients`. Browse the raw
data in MongoDB Compass, connected to `mongodb://localhost:27017/listing_automation`.

---

## Removed since the original 10-phase build

The Phase 9 in-app conversation/inquiry/inbox feature (signed `/l/:token` listing
links, `/t/:token` threads, the realtor `/inbox`) was **removed outright**, not just
deprecated — there's no entry point into it anymore once the email's CTA points
straight at Zillow. See `docs/build-progress.md` for the full rationale. SMS/WhatsApp
sending, and enforcement of the `usageLimit`/`notifications` settings, remain
unbuilt — those fields exist on the data model but nothing acts on them yet.
