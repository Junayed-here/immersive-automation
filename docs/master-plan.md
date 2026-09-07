# Realtor Listing Automation — System Design & Master Plan

**Stack:** Next.js (UI) · Node + Express (API) · MongoDB (data) · Nodemailer (email) · Google Drive/Sheets (spreadsheet source)

**Core loop:** Realtor signs up → connects their client spreadsheet → creates an automation → system pulls listings per ZIP → matches each client's filters → sends each client a personalized HTML email → client clicks "More Info" → a conversation thread opens with the realtor inside the system.

---

## 0. Design principles for this build

Three rules shape almost every decision below.

**1. Every external service sits behind an interface.** Zillow, Google Drive, and SMTP are each wrapped in a provider with a `mock` and a `live` implementation, switched by env var. This is what makes "testable for every functionality except the API" actually achievable — the mock listing provider reads your local JSON and returns the exact same shape the real one would.

**2. The matching engine is a pure function.** `matchListings(listings, clientPrefs, rules) → Listing[]`. No DB, no network, no side effects. It's the heart of the product and the easiest thing to break, so it gets exhaustive unit tests.

**3. Every automation run is a durable record.** Runs, per-client deliveries, and rendered email HTML are all persisted. You can open any past run and see exactly which client got which listings and what the email looked like — critical for debugging and for demoing.

---

## 1. Repository structure

Monorepo, two apps, shared types.

```
listing-automation/
├── apps/
│   ├── web/                        # Next.js (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (auth)/signup/page.tsx
│   │   │   ├── (app)/dashboard/page.tsx
│   │   │   ├── (app)/clients/page.tsx
│   │   │   ├── (app)/integrations/page.tsx
│   │   │   ├── (app)/automations/page.tsx
│   │   │   ├── (app)/automations/new/page.tsx
│   │   │   ├── (app)/automations/[id]/page.tsx
│   │   │   ├── (app)/automations/[id]/runs/[runId]/page.tsx
│   │   │   ├── (app)/inbox/page.tsx
│   │   │   ├── (app)/inbox/[conversationId]/page.tsx
│   │   │   ├── l/[token]/page.tsx          # PUBLIC listing page
│   │   │   └── t/[token]/page.tsx          # PUBLIC client thread page
│   │   ├── components/
│   │   ├── lib/api.ts                      # fetch wrapper, credentials: 'include'
│   │   └── middleware.ts                   # route guard
│   │
│   └── api/                        # Express
│       ├── src/
│       │   ├── server.ts
│       │   ├── config/env.ts
│       │   ├── db/connect.ts
│       │   ├── models/                     # Mongoose schemas
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   │   ├── listings/
│       │   │   │   ├── provider.ts         # interface
│       │   │   │   ├── mock.provider.ts    # reads data/listings.json
│       │   │   │   └── zillow.provider.ts  # real API (stub)
│       │   │   ├── spreadsheet/
│       │   │   │   ├── googleDrive.service.ts
│       │   │   │   ├── localFile.service.ts   # fallback for tests
│       │   │   │   └── parser.ts              # xlsx → Client[]
│       │   │   ├── matching/engine.ts      # PURE
│       │   │   ├── email/
│       │   │   │   ├── transport.ts        # nodemailer / mock
│       │   │   │   └── templates/listingDigest.tsx
│       │   │   ├── automation/runner.ts    # orchestrator
│       │   │   └── tokens.ts               # signed link tokens
│       │   ├── middleware/                 # auth, error, validate, rateLimit
│       │   └── jobs/scheduler.ts           # node-cron
│       └── tests/
│
├── data/
│   ├── listings.json                       # your demo Zillow data
│   ├── realtors.seed.json
│   └── clients.demo.xlsx                   # local copy of the Drive sheet
└── docker-compose.yml                      # mongo + maildev
```

**Why separate `web` and `api` instead of Next.js API routes?** You said Node + Express, and it's the right call here: the automation runner is long-running and scheduled, which doesn't fit serverless-style route handlers. Keeping Express separate also means the scheduler, the runner, and the API share one process and one DB connection.

---

## 2. Data model (MongoDB)

Nine collections. All `_id` are ObjectIds; all documents carry `createdAt`/`updatedAt`.

### `realtors`
```js
{
  _id, email (unique, lowercase), passwordHash,
  firstName, lastName, phone,
  brokerage: { name, address, phone },
  license: { number, state, verified: Boolean, verifiedAt },
  profile: { photoUrl, title, bio, signatureHtml },
  googleDrive: {
    connected: Boolean, email, refreshToken (encrypted), connectedAt, scopes: []
  },
  emailSettings: { fromName, replyTo, dailySendCap: Number },
  status: 'pending' | 'active' | 'suspended'
}
```
Index: `{ email: 1 }` unique.

**On "licensed realtor":** store the license number + state and a `verified` flag. Real verification means hitting a state licensing board (each state is different — no unified API). For v1, ship it as a stub service `verifyLicense()` that always returns `pending` and let an admin flip the flag. Don't block signup on it; block *sending* on it if you want a compliance gate.

### `clients`
```js
{
  _id, realtorId (ref),
  name, email (lowercase), phone,
  preferences: {
    zipCodes: [String],        // array — supports multi-ZIP later, single for now
    familySize: Number,
    bedrooms: Number,
    // optional future: maxPrice, minBaths, propertyType
  },
  source: 'spreadsheet' | 'manual',
  spreadsheetConnectionId (ref, nullable),
  sourceRowHash: String,        // detect row edits on re-sync
  subscribed: Boolean,          // unsubscribe honors this
  lastEmailedAt: Date,
  status: 'active' | 'archived'
}
```
Index: `{ realtorId: 1, email: 1 }` **unique** — this is where 4b's "unique filtered via Email" is enforced. Also `{ realtorId: 1, 'preferences.zipCodes': 1 }`.

### `spreadsheetConnections`
```js
{
  _id, realtorId,
  provider: 'google_drive' | 'upload',
  fileId, fileName, sheetName,
  columnMapping: {              // realtor maps their headers to our fields
    name: 'Full Name', email: 'Email Address', phone: 'Phone',
    zip: 'ZIP', familySize: 'Family Size', bedrooms: 'Beds'
  },
  lastSyncedAt, lastSyncStatus: 'ok'|'error'|'partial',
  lastSyncStats: { rowsRead, created, updated, skipped, errors: [] },
  autoSync: Boolean
}
```

### `automations`
```js
{
  _id, realtorId, name,
  spreadsheetConnectionId,
  audience: { type: 'all' | 'zipList' | 'clientIds', value: [] },
  matchRules: {
    zip: 'exact',
    bedrooms: 'exact' | 'atLeast' | 'atLeastMinusOne',
    familySize: { enabled: Boolean, mode: 'derivedBedrooms' | 'minSqft', sqftPerPerson: 400 },
    maxPrice: Number|null,
    maxListingsPerClient: 10,
    excludePreviouslySent: Boolean     // don't re-send the same listing
  },
  emailTemplate: {
    subject: 'New listings in {{zip}} for you, {{firstName}}',
    introHtml: String,
    ctaLabel: 'More Info',
    theme: { accentColor: '#1a56db' }
  },
  schedule: { mode: 'manual' | 'cron', cron: '0 9 * * 1', timezone: 'America/New_York' },
  status: 'draft' | 'active' | 'paused',
  lastRunAt, nextRunAt
}
```

### `listings` (cache)
```js
{
  _id, provider: 'mock'|'zillow', providerId (zpid),
  zip, address: { line1, city, state, zip },
  price, bedrooms, bathrooms, sqft, lotSize, yearBuilt,
  propertyType, status: 'for_sale'|'pending'|'sold',
  photos: [String], listingUrl, description,
  fetchedAt, raw: {}
}
```
Index: `{ provider: 1, providerId: 1 }` unique, `{ zip: 1, status: 1 }`.

### `automationRuns`
```js
{
  _id, automationId, realtorId,
  trigger: 'manual' | 'scheduled' | 'preview',
  status: 'queued'|'running'|'completed'|'failed'|'partial',
  startedAt, finishedAt,
  stats: { zipsQueried, listingsFetched, clientsProcessed, clientsMatched,
           emailsSent, emailsFailed, emailsSkipped },
  error: { message, stack }
}
```

### `deliveries`
```js
{
  _id, runId, automationId, realtorId, clientId,
  listingIds: [ObjectId],
  status: 'pending'|'sent'|'failed'|'skipped',
  skipReason: 'no_matches'|'unsubscribed'|'cap_reached'|null,
  renderedHtml: String,          // stored so you can view the exact email later
  subject, providerMessageId, sentAt, error
}
```
Index: `{ runId: 1 }`, `{ clientId: 1, sentAt: -1 }`.

### `conversations`
```js
{
  _id, realtorId, clientId, listingId,
  subject, status: 'open'|'closed',
  lastMessageAt, unreadForRealtor: Number, unreadForClient: Number,
  clientAccessToken: String      // long-lived, for the /t/[token] page
}
```
Index: `{ realtorId: 1, clientId: 1, listingId: 1 }` unique.

### `linkEvents`
```js
{ _id, deliveryId, clientId, listingId, type: 'open'|'click', ip, userAgent, createdAt }
```
Optional but cheap, and makes the dashboard feel real.

---

## 3. The listing provider abstraction

This is the single most important piece for testability.

```ts
// services/listings/provider.ts
export interface ListingProvider {
  fetchByZip(zip: string, opts?: FetchOpts): Promise<NormalizedListing[]>;
  fetchById(providerId: string): Promise<NormalizedListing | null>;
}

// mock.provider.ts
export class MockListingProvider implements ListingProvider {
  private listings = JSON.parse(fs.readFileSync('data/listings.json', 'utf8'));
  async fetchByZip(zip, opts) {
    await sleep(150);                                  // simulate latency
    return this.listings
      .filter(l => l.zip === zip && l.status === 'for_sale')
      .map(normalize);
  }
}

// factory
export const getListingProvider = () =>
  process.env.LISTINGS_PROVIDER === 'zillow'
    ? new ZillowProvider(process.env.ZILLOW_API_KEY)
    : new MockListingProvider();
```

Everything downstream — the runner, the matcher, the templates, the tests — only ever sees `NormalizedListing`. When you swap in the real provider, nothing else changes.

**One thing to flag before you build against it:** Zillow does not offer a general public listings API. Their official program is Bridge Interactive (MLS-gated, requires broker credentials and MLS approval), and the "Zillow APIs" on RapidAPI are unofficial scrapers whose reliability and legal standing are shaky. Since you're building the whole system against a mock anyway, this doesn't block you — but plan for the real provider to end up being an MLS/IDX feed, RESO Web API, or a licensed aggregator. Design `NormalizedListing` around RESO field names now and the swap gets much easier later.

---

## 4. Spreadsheet ingestion (Google Drive → MongoDB)

**Flow:**

1. Realtor hits `/integrations`, clicks *Connect Google Drive*.
2. OAuth2 redirect → scopes `drive.readonly` + `spreadsheets.readonly` → callback stores encrypted refresh token on the realtor doc.
3. `GET /api/integrations/google/files?mimeType=spreadsheet` lists their sheets; realtor picks one.
4. System reads row 1, returns detected headers, and the UI shows a **column mapping step** (dropdown per required field, with fuzzy auto-guess: "Email Address" → `email`).
5. Save as a `spreadsheetConnection`.
6. **Sync** — `POST /api/spreadsheets/:id/sync`:
   - Google Sheets API `values.get` (or Drive export → xlsx → SheetJS if it's a real `.xlsx`)
   - For each row: normalize (trim, lowercase email, strip phone to digits, ZIP to 5-char string, cast numbers)
   - Validate: valid email + valid ZIP required; otherwise push to `errors[]` and skip
   - **Dedupe by email** — last row wins, count duplicates in stats
   - `bulkWrite` upsert on `{ realtorId, email }`
   - Rows absent from the sheet since last sync → mark `status: 'archived'` (don't delete)
   - Write `lastSyncStats` and show it in the UI

**Testability:** `localFile.service.ts` reads `data/clients.demo.xlsx` from disk and returns the identical shape. Set `SPREADSHEET_PROVIDER=local` and the whole sync path runs in tests with zero network. Also expose a plain `.xlsx` upload endpoint — useful for demos where you don't want to do the OAuth dance live.

---

## 5. The matching engine (pure, heavily tested)

```ts
export function matchListings(
  listings: NormalizedListing[],
  prefs: ClientPreferences,
  rules: MatchRules
): NormalizedListing[]
```

**Rules, in order:**

| Filter | Logic |
|---|---|
| ZIP | `listing.zip` ∈ `prefs.zipCodes` — exact string match, always applied |
| Status | `for_sale` only |
| Bedrooms | `exact`: `beds === prefs.bedrooms` · `atLeast`: `beds >= prefs.bedrooms` · `atLeastMinusOne`: `beds >= prefs.bedrooms - 1` |
| Family size | `derivedBedrooms`: require `beds >= ceil(familySize / 2)` · `minSqft`: require `sqft >= familySize * sqftPerPerson` |
| Max price | if set, `price <= maxPrice` |
| Previously sent | if `excludePreviouslySent`, drop listings already in a prior `delivery` for this client |
| Sort | price ascending (configurable) |
| Cap | `slice(0, maxListingsPerClient)` |

**Recommended defaults:** `bedrooms: 'atLeast'`, `familySize: enabled with derivedBedrooms`, `maxListingsPerClient: 8`, `excludePreviouslySent: true`. Strict exact-bedroom matching produces a lot of empty emails on small datasets — worth surfacing in the UI as a live "this rule would match N listings for M clients" preview.

Because it's pure, you unit test it with a table of ~25 cases and no mocks at all.

---

## 6. Automation runner (the orchestrator)

```
runAutomation(automationId, { trigger, dryRun })
 │
 ├─ 1. Load automation + realtor; assert status active & license verified
 ├─ 2. Create automationRun { status: 'running' }
 ├─ 3. (optional) Sync spreadsheet first if autoSync
 ├─ 4. Load clients for audience → dedupe by email → filter subscribed
 ├─ 5. Collect UNIQUE zip codes across all clients          ← the key optimization
 ├─ 6. For each unique zip: provider.fetchByZip(zip)
 │      └─ upsert into `listings` cache; build in-memory map zip → listings[]
 ├─ 7. For each client:
 │      ├─ matched = matchListings(byZip[client.zip], client.prefs, rules)
 │      ├─ if empty → delivery { status: 'skipped', skipReason: 'no_matches' }
 │      ├─ create delivery { status: 'pending' } → get deliveryId
 │      ├─ generate signed token per listing (see §7)
 │      ├─ render HTML (realtor block + listing cards + CTA + unsubscribe)
 │      ├─ if dryRun → save renderedHtml, status 'skipped', DO NOT SEND
 │      └─ else → transport.send() → update delivery status + messageId
 ├─ 8. Update run stats, status 'completed' | 'partial' | 'failed'
 └─ 9. Return run summary
```

**Important details:**
- Step 5 is why the design collects unique ZIPs first — 500 clients across 12 ZIPs means 12 API calls, not 500.
- Wrap per-client work in try/catch so one bad email doesn't kill the run; mark that delivery `failed` and continue.
- Throttle sends (`p-limit` at 5 concurrent, plus a per-realtor `dailySendCap`).
- **Dry run / preview mode is a first-class feature.** `POST /api/automations/:id/preview` runs steps 1–7 with `dryRun: true`, sends nothing, and returns per-client match counts plus renderable HTML. This is how you demo and test the entire pipeline safely.

**Scheduling:** `node-cron` in the API process reads active automations on boot and on change. Fine for a single instance. If you ever run multiple instances, move to BullMQ + Redis so jobs aren't double-fired — but don't build that now.

---

## 7. The "More Info" link → conversation flow

This is the part that makes it a product rather than a mail merge.

**Token.** Each listing card's CTA embeds a signed, opaque token:
```ts
jwt.sign(
  { d: deliveryId, c: clientId, l: listingId, r: realtorId },
  LINK_SECRET,
  { expiresIn: '90d' }
)
```
URL: `https://app.example.com/l/<token>`. No login, no guessable IDs, revocable by rotating the secret.

**Client journey:**
1. Clicks *More Info* → `/l/[token]`
2. Next.js server-component verifies the token via `GET /api/public/listing/:token`, logs a `linkEvent` (click), renders: full listing detail, photo gallery, the realtor's profile card, and a message box **pre-filled** with `"Hi {realtor}, I'd like more information about {address}."`
3. Client edits/submits → `POST /api/public/inquiry/:token`
4. Backend: find-or-create `conversation` (unique on realtor+client+listing), insert first `message` with `senderType: 'client'`, generate `clientAccessToken`, increment `unreadForRealtor`
5. Realtor gets a notification email: *"New inquiry from {client} about {address}"* linking to `/inbox/[id]`
6. Client gets a confirmation email containing their thread link `/t/<clientAccessToken>` — they reply there, no signup ever required
7. Realtor replies from `/inbox/[id]` → message saved → client emailed with the thread link

Both sides now have a persistent, in-system thread tied to a specific listing. Poll every 10s on the open thread page for v1; WebSockets later if you want live typing indicators.

---

## 8. Email template

Use **MJML** (compiles to bulletproof table-based HTML) or hand-rolled tables — do not use flexbox/grid, Outlook will destroy it.

Structure:
```
┌──────────────────────────────────────┐
│ Realtor photo · Name · Brokerage     │  ← header, accent color from template
│ License #12345 · phone · email       │
├──────────────────────────────────────┤
│ "Hi Sarah, here are 4 new listings   │  ← personalized intro
│  in 11373 matching your search."     │
├──────────────────────────────────────┤
│ ┌────────┐  123 Main St              │
│ │ photo  │  $485,000                 │  ← listing card, repeated
│ │        │  3 bd · 2 ba · 1,450 sqft │
│ └────────┘  [ More Info ]  ← token   │
├──────────────────────────────────────┤
│ (repeat per listing)                 │
├──────────────────────────────────────┤
│ Realtor signature block              │
│ Physical address · Unsubscribe       │  ← CAN-SPAM requires both
└──────────────────────────────────────┘
```

Handlebars-style variables: `{{firstName}}`, `{{zip}}`, `{{listingCount}}`, `{{realtorName}}`.

**Compliance, briefly, because this is bulk commercial email:** CAN-SPAM requires a working unsubscribe link honored within 10 days, a real physical postal address in the footer, accurate From/Subject lines, and no deceptive headers. Add `subscribed: false` handling and a `/unsubscribe/:token` public route on day one — retrofitting it after you have real users is painful. Also: sending on behalf of realtors means you'll want per-realtor SPF/DKIM alignment eventually, or send from your own domain with the realtor as `replyTo` (simpler, better deliverability early on).

**Local testing:** MailDev or Mailhog in Docker. Nodemailer points at `localhost:1025`, web UI at `localhost:1080`, and every email your system sends is inspectable in a browser. No real emails, full fidelity. Add a `MockTransport` too that just pushes into an array for assertions in unit tests.

---

## 9. API surface

```
AUTH
POST   /api/auth/signup            { email, password, firstName, lastName, phone, license }
POST   /api/auth/login             → sets httpOnly JWT cookie
POST   /api/auth/logout
GET    /api/auth/me
PATCH  /api/auth/profile           { photo, brokerage, signatureHtml, emailSettings }

CLIENTS
GET    /api/clients                ?search=&zip=&page=
POST   /api/clients                manual add
PATCH  /api/clients/:id
DELETE /api/clients/:id            (soft → archived)
POST   /api/clients/bulk-archive

INTEGRATIONS
GET    /api/integrations/google/connect        → 302 to Google consent
GET    /api/integrations/google/callback
DELETE /api/integrations/google
GET    /api/integrations/google/files
GET    /api/spreadsheets/:id/headers           → for column mapping UI
POST   /api/spreadsheets/connect
POST   /api/spreadsheets/:id/sync              → sync stats
POST   /api/spreadsheets/upload                (multipart .xlsx fallback)

AUTOMATIONS
GET    /api/automations
POST   /api/automations
GET    /api/automations/:id
PATCH  /api/automations/:id
DELETE /api/automations/:id
POST   /api/automations/:id/preview            ← DRY RUN, no sends
POST   /api/automations/:id/run                ← real run
GET    /api/automations/:id/runs
GET    /api/runs/:runId                        → run + deliveries
GET    /api/deliveries/:id/html                → the exact email that was sent

LISTINGS
GET    /api/listings?zip=&beds=&maxPrice=      (provider-backed, cached)

CONVERSATIONS (realtor, authed)
GET    /api/conversations                      ?status=open
GET    /api/conversations/:id
POST   /api/conversations/:id/messages
PATCH  /api/conversations/:id                  close/reopen

PUBLIC (token-authed, no login)
GET    /api/public/listing/:token
POST   /api/public/inquiry/:token              { message }
GET    /api/public/thread/:clientToken
POST   /api/public/thread/:clientToken/messages
GET    /api/public/unsubscribe/:token
```

**Middleware stack:** helmet → cors(credentials) → json → cookieParser → rateLimit (strict on public + auth routes) → route → zod validation → controller → central error handler.

---

## 10. UI screens

Keep it genuinely simple — Tailwind + shadcn/ui, no custom design system.

| Route | Contents |
|---|---|
| `/signup` | Email, password, name, phone, license #, license state. Inline validation. |
| `/login` | Email + password. |
| `/dashboard` | Four stat cards (clients, active automations, emails sent 30d, open conversations), recent runs table, unread inquiries list. |
| `/clients` | Searchable/filterable table: Name · Email · Phone · ZIP · Family Size · Bedrooms · Source · Last emailed. Manual add/edit drawer. "Sync from spreadsheet" button with last-sync badge. |
| `/integrations` | Google Drive card (Connect / Connected as x@y). File picker → sheet picker → **column mapping table** → Save. Sync button + last sync results panel showing rows read / created / updated / skipped / errors. |
| `/automations` | Card list: name, audience size, schedule, status toggle, last run result. |
| `/automations/new` | **4-step wizard:** ① Name + spreadsheet source · ② Audience (all / by ZIP / pick clients) · ③ Match rules — with a **live "matches N listings across M clients" counter** · ④ Email template (subject, intro, accent color) with side-by-side live preview. Final screen: *Save as draft* / *Save & run preview*. |
| `/automations/[id]` | Overview, rules summary, run history table, [Run Preview] and [Run Now] buttons. |
| `/automations/[id]/runs/[runId]` | Run stats header. Per-client table: client · matched count · status · [View Email] modal rendering the stored `renderedHtml` in an iframe. |
| `/inbox` | Two-pane: conversation list (client name, listing address, snippet, unread dot) + thread view with reply composer. |
| `/l/[token]` | **Public.** Listing hero photo, price, specs, description, realtor card, pre-filled message form. Post-submit confirmation state. |
| `/t/[token]` | **Public.** Full thread with the realtor + reply box. |

**Auth handling:** JWT in an httpOnly cookie set by Express; `middleware.ts` in Next checks for the cookie's presence and redirects to `/login`. Actual verification happens server-side on every API call — the middleware is just UX.

---

## 11. Local environment setup

### `docker-compose.yml`
```yaml
services:
  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
  maildev:
    image: maildev/maildev
    ports: ["1080:1080", "1025:1025"]
volumes: { mongo-data: }
```

`docker compose up -d` → Mongo on 27017, email inbox UI at `localhost:1080`.

### `apps/api/.env`
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/listing_automation
JWT_SECRET=dev_change_me
LINK_SECRET=dev_change_me_too
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

LISTINGS_PROVIDER=mock          # mock | zillow
MOCK_LISTINGS_PATH=./data/listings.json
ZILLOW_API_KEY=

SPREADSHEET_PROVIDER=google     # google | local
LOCAL_SHEET_PATH=./data/clients.demo.xlsx
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/integrations/google/callback

MAIL_TRANSPORT=smtp             # smtp | mock
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM="Listing Bot <noreply@localhost>"
```

### Seed script
`npm run seed` should:
1. Wipe the dev DB
2. Create 2 realtors (one verified, one pending) — password `password123`
3. Import `data/clients.demo.xlsx` for realtor #1 via the same parser the real sync uses
4. Load `data/listings.json` into the `listings` cache
5. Create one draft automation and one active one
6. Print login credentials to console

Running seed → login → run preview should work within 60 seconds of a fresh clone. That's the bar.

### Required shape of `data/listings.json`
```json
[{
  "zpid": "2078234567",
  "address": { "line1": "123 Main St", "city": "Elmhurst", "state": "NY", "zip": "11373" },
  "price": 485000,
  "bedrooms": 3, "bathrooms": 2, "livingArea": 1450, "lotSize": 2500,
  "yearBuilt": 1998, "propertyType": "SINGLE_FAMILY", "status": "for_sale",
  "photos": ["https://..."],
  "listingUrl": "https://www.zillow.com/homedetails/...",
  "description": "..."
}]
```
Make sure your demo file covers: multiple ZIPs, a spread of bedroom counts (1–5), a spread of prices, and at least one ZIP with **zero** matches for some client — you want to exercise the `no_matches` path.

---

## 12. Test plan

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest/Jest | `matchListings` (~25 cases: exact/atLeast bedrooms, family size derivation, price cap, empty results, cap slicing) · spreadsheet parser (bad emails, dup emails, missing columns, numeric-as-string ZIPs, leading-zero ZIPs) · token sign/verify/expiry · template rendering |
| Integration | Supertest + `mongodb-memory-server` | Every route. Auth guards. Ownership checks (realtor A cannot read realtor B's clients). Sync idempotency — run twice, assert no duplicate clients. |
| Runner | Vitest + MockProvider + MockTransport | Full `runAutomation` against seeded data. Assert: unique-ZIP call count, correct deliveries created, per-client listing sets correct, `no_matches` skips, one failing send doesn't abort the run, `dryRun` sends zero emails. |
| E2E | Playwright | signup → login → connect local sheet → map columns → sync → create automation → preview → run → open MailDev → click *More Info* → submit inquiry → realtor sees it in `/inbox` → replies → client sees reply in `/t/[token]`. |

That Playwright path is the whole product in one test. Get it green and you're done.

**Explicitly out of scope for automated tests:** the live Zillow provider. Cover it with a single contract test asserting `ZillowProvider` returns something conforming to the `NormalizedListing` schema, skipped unless `ZILLOW_API_KEY` is set.

---

## 13. Build order

| Phase | Deliverable | Done when |
|---|---|---|
| **1** | Scaffold: monorepo, docker-compose, Mongo connection, health route, Next shell | `docker compose up` + both apps boot |
| **2** | Auth: models, signup/login/me, JWT cookie, Next middleware, login+signup pages | You can log in and see an empty dashboard |
| **3** | Clients CRUD + `/clients` table + manual add | Manual client management works end to end |
| **4** | Spreadsheet: parser, **local** provider first, sync endpoint, column mapping UI | `SPREADSHEET_PROVIDER=local` sync imports the demo xlsx correctly |
| **5** | Listing provider + mock + `/api/listings` + seed script | `GET /api/listings?zip=11373` returns your JSON |
| **6** | **Matching engine + unit tests** | 25 unit tests green — do this before the runner |
| **7** | Runner + dry-run + MJML template + MailDev | Preview shows correct per-client matches; real run lands in MailDev |
| **8** | Automation builder UI + run detail + email viewer | Full wizard → run → inspect stored HTML |
| **9** | Tokens + `/l/[token]` + inquiry + conversations + `/inbox` + `/t/[token]` | Click-through from a MailDev email creates a real thread |
| **10** | Google Drive OAuth (swap `SPREADSHEET_PROVIDER=google`) | Real Drive file syncs |
| **11** | Scheduler, unsubscribe, rate limits, Playwright E2E | Full E2E green |

**Phases 4 and 10 are deliberately split.** Build the entire pipeline against a local `.xlsx` first — Google OAuth is fiddly, involves consent screens and redirect URIs, and has nothing to do with your core logic. Plug it in near the end when everything else already works.

---

## 14. Things worth deciding early

1. **Bedroom matching semantics.** `exact` feels precise but produces empty emails constantly. Recommend defaulting to `atLeast` and letting the realtor tighten it.
2. **What "family size" actually means.** It's not a standard listing field, so you're deriving it. `beds >= ceil(familySize/2)` is a reasonable default; sqft-based is the alternative. Pick one, make it configurable, document it in the UI so realtors know what it does.
3. **Multi-ZIP per client.** Your spec says one ZIP, but modeling `zipCodes` as an array from day one costs nothing and saves a migration.
4. **Re-sending listings.** Without `excludePreviouslySent`, clients get the same houses every week and unsubscribe. Default it to on.
5. **Sending domain.** Send from your domain with the realtor as `replyTo`. Per-realtor custom domains means per-realtor DKIM setup — real work, worth deferring.
6. **License verification.** Ship as a manual/admin flag. Automating it means 50 different state boards.

---

## 15. Quick reference — end-to-end data flow

```
Google Sheet ──sync──> clients (Mongo, unique per realtor+email)
                            │
                            ├─ collect unique ZIPs
                            ▼
data/listings.json ──MockProvider──> listings cache (Mongo)
                            │
                            ▼
                   matchListings(pure fn)
                            │
                            ▼
              deliveries (Mongo) + rendered HTML
                            │
                        Nodemailer
                            ▼
                    MailDev :1080
                            │
                  [More Info] signed token
                            ▼
                   /l/[token] public page
                            │
                        inquiry POST
                            ▼
             conversations + messages (Mongo)
                     ↙              ↘
          realtor /inbox        client /t/[token]
```
