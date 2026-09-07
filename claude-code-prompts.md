# Claude Code prompts — Realtor Listing Automation

Paste these into Claude Code in VS Code, one per session. Bump `CURRENT PHASE` in
`CLAUDE.md` after each one passes.

---

## 0. Session kickoff (run once, at the start of every new session)

```
Read CLAUDE.md and docs/master-plan.md in full before doing anything.

Then, without writing any code, tell me:
1. What phase we're on and what it covers
2. What already exists in the repo
3. Your plan for this phase as a numbered file-by-file list
4. Any place the spec is ambiguous or contradicts itself

Wait for my go-ahead before writing code.
```

That last question is the valuable one. A spec conflict caught before the code is
written costs a sentence; caught after, it costs a migration.

---

## Phase 2 — Auth

```
Read docs/master-plan.md and CLAUDE.md first, then implement Phase 2 (auth) only.

SCOPE — build exactly this, nothing more:
- apps/api/ scaffold: package.json (ESM, "type": "module"), .env.example, .gitignore
- Express app factory in src/app.js exported as createApp() — not started at import
  time, so tests can mount it without opening a port
- src/server.js entry with graceful shutdown
- src/config/env.js — loads dotenv, hard-fails at startup if MONGODB_URI or
  JWT_SECRET is missing
- src/db/connect.js — Mongoose connection with a clear message if Mongo isn't running
- src/models/Realtor.js per master-plan §2: passwordHash select:false, static
  hashPassword(), method comparePassword(), toJSON transform stripping secrets,
  fullName virtual
- Routes: POST /api/auth/signup, POST /api/auth/login, POST /api/auth/logout,
  GET /api/auth/me (protected), PATCH /api/auth/profile (protected)
- GET /health returning { ok: true }
- Auth middleware reading the token from EITHER an httpOnly cookie OR an
  Authorization: Bearer header — Bearer is what I use in Postman
- zod validation middleware returning 400 with per-field details
- Central error handler: Mongoose ValidationError→400, CastError→400,
  duplicate key 11000→409
- asyncHandler wrapper
- express-rate-limit: strict on /api/auth, generous elsewhere
- helmet, cors({ origin: APP_URL, credentials: true }), cookie-parser, morgan in dev

DO NOT build: clients, spreadsheets, listings, automations, the runner, email,
or conversations.

ACCEPTANCE:
1. npm run dev boots and logs the Mongo connection + port
2. POST /api/auth/signup returns 201 and the document is written to MongoDB
3. No response anywhere contains passwordHash
4. Signing up twice with the same email returns 409, not 500
5. Wrong password and nonexistent email return the SAME 401 message
6. GET /api/auth/me returns 401 with no token, 200 with a valid Bearer token
7. A malformed signup body returns 400 with a field-by-field details array

When done: list the files you created and give me the exact Postman requests
(method, URL, JSON body) to verify items 2-7.
```

---

## Phase 3 — Clients CRUD

```
Read CLAUDE.md. Implement Phase 3 (clients) only.

BUILD:
- src/models/Client.js per master-plan §2:
    realtorId, name, email (lowercase), phone,
    preferences: { zipCodes: [String], familySize, bedrooms },
    source: 'spreadsheet'|'manual', spreadsheetConnectionId, sourceRowHash,
    subscribed (default true), lastEmailedAt, status: 'active'|'archived'
  Compound UNIQUE index { realtorId: 1, email: 1 }
  Index { realtorId: 1, 'preferences.zipCodes': 1 }
- Routes, all scoped by req.realtorId:
    GET    /api/clients          ?search= &zip= &status= &page= &limit=
    POST   /api/clients
    GET    /api/clients/:id
    PATCH  /api/clients/:id
    DELETE /api/clients/:id      → soft delete, status:'archived'
- zod validators. ZIP must normalize to a 5-char string via padStart(5,'0').

Model zipCodes as an ARRAY even though the UI collects one value — it costs
nothing now and saves a migration later.

ACCEPTANCE:
1. Creating two clients with the same email under one realtor returns 409
2. The SAME email under a DIFFERENT realtor succeeds
3. Realtor A requesting realtor B's client _id gets 404 (not 403 — don't confirm
   the record exists)
4. Posting zip "7069" stores "07069"
5. DELETE sets status archived; the record still exists in MongoDB
6. GET /api/clients excludes archived by default

When done: list files and the Postman requests to verify 1-6.
```

---

## Phase 4 — Spreadsheet ingestion (public link)

```
Read docs/master-plan.md §4 (public-link spreadsheet ingestion) and CLAUDE.md.
Implement Phase 4 only. §4 was rewritten — we are NOT using Google Drive OAuth.
Realtors paste a public Google Sheet link after creating their profile.

BUILD:
- src/models/SpreadsheetConnection.js per §4.6, including the compound unique
  index on { realtorId, fileId, gid }
- src/services/spreadsheet/urlParser.js — extract { fileId, gid } from every URL
  form in §4.2; build the canonical export URL ourselves
- src/services/spreadsheet/fetcher.js — SheetFetcher interface with
  HttpSheetFetcher and LocalSheetFetcher, switched by SHEET_FETCHER env var
- src/services/spreadsheet/parser.js — CSV → normalized client rows per §4.7
- src/services/spreadsheet/sync.service.js — the sync pipeline
- Routes per §4.8, all scoped by realtorId

CRITICAL — these three are the whole point of this phase:
1. SSRF guard (§4.3): host allowlist docs.google.com only, rebuild the URL from
   the parsed fileId, never fetch user input directly, validate redirect hosts,
   15s timeout, 10MB size cap.
2. Private-sheet detection (§4.4): a private sheet returns 200 with an HTML
   sign-in body. Check content-type for text/html and the body for <!DOCTYPE.
   A status-code check alone WILL parse a login page as client data.
3. ZIP normalization (§4.7): String(zip).trim().padStart(5,'0'). Sheets exports
   07069 as 7069.

Also: dedupe rows by email (last wins), upsert on { realtorId, email }, archive
rows that disappeared from the sheet, never hard-delete, cap errors[] at 50.

Create the four fixtures in data/fixtures/ from §4.9, including not-public.html.

ACCEPTANCE:
1. All URL forms in §4.2 parse correctly (unit tests)
2. A non-Google host is rejected 400 before any network call happens
3. The not-public.html fixture produces error code NOT_PUBLIC, not a parsed list
4. buyers-messy.csv: leading-zero ZIPs survive as 5-char strings, duplicate
   emails collapse to one client, invalid rows land in errors[] without
   aborting the run
5. Running sync twice creates zero clients the second time (idempotent)
6. POST /api/spreadsheets/preview returns headers + 5 sample rows and persists
   NOTHING

When done: list files and the Postman requests to verify 2-6.
```

---

## Phase 5 — Listing provider

```
Read CLAUDE.md. Implement Phase 5 (listings) only.

BUILD:
- src/models/Listing.js — cache per master-plan §2, unique index
  { provider, providerId }, index { zip, status }
- src/services/listings/provider.js — the ListingProvider interface:
    fetchByZip(zip, opts) -> NormalizedListing[]
    fetchById(providerId) -> NormalizedListing | null
- src/services/listings/mock.provider.js — reads data/listings.json, filters by
  zip and status, simulates ~150ms latency
- src/services/listings/zillow.provider.js — STUB ONLY. Correct shape, throws
  NotImplemented. Do not write real HTTP calls.
- src/services/listings/normalize.js — raw → NormalizedListing. Use RESO-style
  field names so swapping in a real MLS/IDX feed later is a small change.
- Factory switching on LISTINGS_PROVIDER=mock|zillow
- GET /api/listings?zip=&beds=&maxPrice= — provider-backed, upserts into cache

ACCEPTANCE:
1. GET /api/listings?zip=11373 returns listings from data/listings.json
2. Results are upserted into the listings collection; calling twice does not
   duplicate documents
3. Both providers satisfy the same interface (a shared contract test)
4. Nothing outside src/services/listings/ imports data/listings.json

When done: list files and the Postman requests to verify 1-3.
```

---

## Phase 6 — Matching engine

```
Read CLAUDE.md and master-plan §5. Implement Phase 6 only.

Write ONE pure function:
  matchListings(listings, prefs, rules) -> NormalizedListing[]
in src/services/matching/engine.js

No DB, no network, no Date.now(), no mutation of inputs. Given the same inputs it
must always return the same output.

Rules, applied in order (master-plan §5):
  1. ZIP: listing.zip must be in prefs.zipCodes (exact string match)
  2. Status: for_sale only
  3. Bedrooms: rules.bedrooms is 'exact' | 'atLeast' | 'atLeastMinusOne'
  4. Family size: 'derivedBedrooms' → beds >= ceil(familySize/2)
                  'minSqft'        → sqft >= familySize * rules.sqftPerPerson
  5. Max price: if set, price <= maxPrice
  6. Exclusions: drop any listing id in prefs.excludeListingIds
  7. Sort by price ascending
  8. Cap at rules.maxListingsPerClient

Then write ~25 unit tests covering at minimum: each bedroom mode, both family-size
modes, the price cap, empty input, no matches, cap slicing, missing/null prefs
fields, a ZIP with no listings, and confirmation that the input array is not mutated.

Use node:test + node:assert. No new test dependency.

ACCEPTANCE: all tests green via `npm test`, and the engine file imports nothing
from src/models, src/db, or any service.

Build ONLY this. The runner is Phase 7.
```

---

## Between phases

After a phase passes, run this before bumping the number:

```
Review the code you just wrote against CLAUDE.md's architecture rules. For each
rule, state whether the phase complies. Then list anything you'd flag as
technical debt we're carrying into the next phase.

Don't fix anything yet — just report.
```

And when something breaks:

```
Here's the error: <paste>
Here's the request that caused it: <paste>

Diagnose the root cause before changing any code. Tell me what's wrong and why,
then propose the fix. Don't apply it until I say go.
```
