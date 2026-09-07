# Project: Realtor Listing Automation

A SaaS where an Admin manually onboards each licensed realtor ("Client") with a buyer
list, and the system automatically emails each buyer only the listings matching their
personal filters. Each listing's button links directly to its real Zillow page. See
"Post-launch: Admin-managed model" below — the original self-serve design (realtors
sign up themselves, "More Info" opens an in-app conversation thread) was superseded.

**Spec: `docs/master-plan.md`. Follow it. Do not invent alternate architecture.**
If something in the spec seems wrong, say so and wait — do not silently deviate.

---

## Current phase

```
CURRENT PHASE: done (all 10 phases complete — see docs/build-progress.md)
```

Build only the current phase. Do not scaffold, stub, or "prepare for" later phases.
When a phase passes acceptance, I will bump this number myself.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Node 20+, Express 4, ESM (`"type": "module"`), **plain JavaScript** (no TypeScript) |
| DB | MongoDB + Mongoose 8, local, database `listing_automation` |
| Auth | JWT — httpOnly cookie **and** `Authorization: Bearer` (Bearer is for Postman). Admin-only — see "Post-launch" below |
| Validation | zod, on every route that accepts a body |
| Frontend (later) | Next.js App Router, Tailwind, shadcn/ui |
| Email (later) | Nodemailer → MailDev on localhost:1025 in dev |

Layout: `apps/api/` (backend), `apps/web/` (frontend, later), `data/` (fixtures + demo
listings JSON), `docs/` (spec).

---

## Architecture rules

These are the rules that keep the project testable and safe. Breaking one is a bug
even if the feature works.

1. **Every external service sits behind an interface** with a mock and a live
   implementation, switched by env var. Never call Zillow, Google, or SMTP directly
   from a controller.
   - `LISTINGS_PROVIDER=mock|zillow`
   - `SHEET_FETCHER=local|http`
   - `MAIL_TRANSPORT=mock|smtp`

2. **The matching engine is a pure function.** `matchListings(listings, prefs, rules)`
   — no DB, no network, no `Date.now()`, no side effects. It gets exhaustive unit
   tests before the runner is built.

3. **Multi-tenant isolation.** Every query is scoped by `realtorId`. No exceptions.
   Realtor A must never be able to read or mutate realtor B's data — including by
   passing a guessed `_id`.

4. **Thin controllers.** validate → service → respond. Business logic lives in
   `src/services/`.

5. **Every async handler is wrapped in `asyncHandler`.** All errors flow to one
   central error middleware. No `try/catch` returning `res.status(500)` inline.

6. **Never leak secrets.** `passwordHash` and any OAuth/refresh tokens are
   `select: false` AND stripped in the model's `toJSON` transform. No response,
   log, or error message may contain them.

7. **Never hard-delete user data.** Soft-delete with a `status` field.

8. **Persist enough to debug.** Automation runs store per-client deliveries and the
   exact rendered email HTML.

---

## Data handling rules

Learned from real failure modes — do not skip these.

- **ZIP codes are strings, always 5 characters.**
  `String(zip).trim().padStart(5, '0')`. Google Sheets exports `07069` as `7069`.
  Every Northeast US ZIP starts with 0.
- **Emails are the client identity key.** Lowercase + trim before every write and
  lookup. Unique compound index `{ realtorId, email }`.
- **Dedupe by email on import** — last row wins, and count the duplicates in the
  sync stats.
- **Bad rows never abort an import.** Collect them into `errors[]` (cap 50) and keep
  processing.
- **Imports are idempotent.** Running the same sync twice must create zero new
  records the second time.

---

## Security rules

- **SSRF**: the realtor pastes a public spreadsheet URL, so the server fetches a
  user-supplied URL. Host allowlist (`docs.google.com` only), rebuild the export URL
  from the parsed file ID, never `fetch(userInput)`, validate every redirect hop,
  15s timeout, 10MB size cap.
- **A private Google Sheet returns `200 OK` with an HTML sign-in page**, not a 403.
  Checking status codes alone will parse a login page as client data. Check
  `content-type` for `text/html` and the body for `<!DOCTYPE`.
- Same 401 message for "wrong password" and "no such email" — don't leak which
  addresses are registered.
- Rate limit `/api/admin/auth` tightly; everything else generously.
- Public token links (unsubscribe) are signed JWTs, never raw database IDs.

---

## We are NOT using Google Drive OAuth

Superseded. Realtors paste a public Google Sheet link after creating their profile.
No Google Cloud project, no consent screen, no refresh tokens. See `master-plan.md`
§4. If you find OAuth references elsewhere in the docs, they are stale — flag them.

---

## Post-launch: Admin-managed model

Superseded after the original 10 phases shipped — see `docs/build-progress.md`'s
"Admin-managed model" section for the full detail. The short version:

- **No realtor self-serve signup/login.** A single Admin logs in
  (`/api/admin/auth/*`) and onboards every realtor ("Client") manually via
  `POST /api/admin/clients`, no password. Every other endpoint is nested under
  `/api/admin/clients/:realtorId/...` — Admin acts as a specific realtor by id,
  not via that realtor's own session.
- **"Client" (in conversation/UI) = the realtor.** The imported/manually-added
  people who receive listing emails were renamed **"Buyer"** everywhere in the
  code (model, routes, tests) — they used to be called "Client" in code, which
  now means something different. Don't reintroduce that ambiguity.
- **The in-app conversation/inquiry/inbox feature (old Phase 9) is gone**, not
  dormant — `Conversation`/`Message`/`LinkEvent` models, `/l/:token`,
  `/t/:token`, and `/inbox` were deleted. The email's listing CTA links
  straight to the real Zillow URL now.
- `usageLimit` and `notifications.enabled` exist on the Realtor model as
  stored placeholders — nothing enforces or acts on them yet. Don't build
  enforcement without asking what they should actually do first.
- The spreadsheet schema grew from 6 columns to 16 (bathrooms, basement, home
  type, parking, sqft, year built, buy/rent, three opt-in channels) — see the
  Buyer model and `services/spreadsheet/parser.js`.

---

## API response shape

Success:
```json
{ "success": true, "message": "...", "data": { } }
```
Error:
```json
{ "success": false, "error": { "message": "...", "details": [ { "field": "email", "message": "..." } ] } }
```
Status codes: 400 validation · 401 unauthenticated · 403 not permitted ·
404 missing · 409 duplicate · 429 rate limited · 500 bug.

---

## Build order

Do not skip ahead.

| # | Phase | Done when |
|---|---|---|
| 1 | Scaffold: monorepo, docker-compose, Mongo connect, `/health` | both apps boot |
| 2 | **Auth**: Realtor model, signup/login/me/logout/profile | user doc appears in MongoDB |
| 3 | Clients CRUD | manual client management works end to end |
| 4 | Spreadsheet: URL parse, SSRF-guarded fetch, CSV parse, sync | messy fixture imports correctly |
| 5 | Listing provider + mock reading `data/listings.json` | `GET /api/listings?zip=` returns data |
| 6 | **Matching engine + unit tests** | ~25 unit tests green |
| 7 | Automation runner + dry run + email template + MailDev | preview shows correct per-client matches |
| 8 | Automation builder UI + run detail + email viewer | wizard → run → inspect stored HTML |
| 9 | Signed tokens, `/l/:token`, inquiries, conversations, inbox | click in MailDev creates a real thread |
| 10 | Scheduler, unsubscribe, Playwright E2E | full E2E green |

Phase 6 comes before phase 7 deliberately — the matcher must be proven correct before
anything depends on it.

---

## Definition of done for a phase

1. Runs locally with `npm run dev`, no console errors or warnings
2. Every new endpoint verified in Postman
3. `.env.example` updated with any new variables
4. No secret appears in any response
5. Multi-tenant scoping verified — realtor A cannot reach realtor B's records
6. You list the files created and the exact Postman requests to verify them

---

## Working style

- Ask before adding a dependency that isn't already in `package.json`.
- Ask before changing a schema that a previous phase already wrote to.
- Don't add TypeScript, an ORM, GraphQL, Docker for the app, or a state library.
- Don't write README files or inline comments explaining obvious code. Comment the
  *why* on non-obvious decisions only.
- Small, focused commits — one concern each.
- If a requirement is ambiguous, stop and ask. A wrong assumption baked into a schema
  costs a migration later.
