# Site map

A reference for every route in the app — what renders, what it calls, and how
the pieces connect. Keep this in sync when routes are added, removed, or
renamed; it's the fastest way to answer "does X exist" without grepping.

Auth model recap (see `CLAUDE.md`): one Admin logs in. There is no realtor or
buyer login. Admin acts *as* a realtor by id — every realtor-scoped API route
is nested under `/api/admin/clients/:realtorId/...`, and every realtor-scoped
page is nested under `/admin/clients/[realtorId]/...`.

---

## Frontend (`apps/web/app/`)

```
/                                                        → redirects to /admin/clients
/admin/login                                             → sign in
/unsubscribe/[token]                                     → public, no auth

/admin/clients                                           → all realtors
/admin/clients/[realtorId]                               → one realtor, tab: Overview
  /buyers                                                →   tab: Buyers (list)
  /buyers/[buyerId]                                      →     buyer detail (Overview | Settings)
  /automations                                           →   tab: Automations (list)
  /automations/new                                       →     creation wizard
  /automations/[automationId]                            →     automation detail
  /automations/[automationId]/runs/[runId]                →     one run's deliveries
  /settings                                              →   tab: Settings
```

### `/` — redirect only
No UI. `app/page.js` immediately `redirect()`s to `/admin/clients`.

### `/admin/login`
Sign-in form. Posts to `POST /api/admin/auth/login`; on success, redirects to
`?next=` (set by `middleware.js` when an unauthenticated request hits a
protected route) or `/admin/clients`.

### `/unsubscribe/[token]`
The only page a buyer ever sees. `token` is a signed JWT embedded in every
delivered email's footer link (`services/tokens.js`), not a raw id. Reads via
`GET /api/public/unsubscribe/:token` (side-effect-free — shows who's about to
be unsubscribed), then an explicit "Yes, unsubscribe me" click fires
`POST /api/public/unsubscribe/:token`.

### `/admin/clients` — realtor list
Admin-wide dashboard: `GET /api/admin/overview` (stat cards, two charts, a
"needs attention" feed for failed runs / errored spreadsheet syncs) plus
`GET /api/admin/clients` (paginated table, search). Onboards a new realtor via
a modal → `POST /api/admin/clients` (optionally creating a `SpreadsheetConnection`
in the same call if a sheet URL is given).

### `/admin/clients/[realtorId]/*` — shared layout
`app/admin/clients/[realtorId]/layout.js` fetches the realtor's name/email
(`GET /api/admin/clients/:realtorId`) for the header, and renders the
Overview / Buyers / Automations / Settings tab bar every page below inherits.

- **`/admin/clients/[realtorId]`** (Overview tab): per-realtor stat cards and
  charts, `GET /api/admin/clients/:realtorId/overview` — the realtor-scoped
  twin of the admin-wide overview above. Recent-runs table.
- **`/admin/clients/[realtorId]/buyers`**: paginated buyer table —
  `GET .../buyers` (search, zip filter, status filter, includes a
  `sentListingsCount` computed server-side). Active/inactive toggle PATCHes
  `subscribed` inline. A chevron expands an inline row of the buyer's full
  filter set; its gear icon deep-links to the buyer detail page's Settings
  tab. "Add buyer" modal → `POST .../buyers`.
- **`/admin/clients/[realtorId]/buyers/[buyerId]`**: two tabs (state kept in
  `?tab=`).
  - Overview: stat cards + charts from `GET .../buyers/:id/analytics`; send
    history as an accordion (`GET .../buyers/:id/deliveries`, listings
    populated) — expand a delivery to see its listings, click one to see a
    detail card (image/price/beds/baths/external Zillow link).
  - Settings: name/email/phone/preferences form + the subscribed toggle,
    `PATCH .../buyers/:id`.
- **`/admin/clients/[realtorId]/automations`**: automation list —
  `GET .../automations`. Activate/Pause toggles `PATCH .../automations/:id`
  (`{status}`); delete is only offered for non-active automations.
- **`/admin/clients/[realtorId]/automations/new`**: 5-step wizard (Name &
  source → Audience → Match rules → Schedule → Email template). Creates the
  automation on step 1 (`POST .../automations`), then `PATCH`es it after each
  subsequent step. "Preview matches" and "Refresh preview" both call
  `POST .../automations/:id/preview`, the latter also fetching the rendered
  HTML of a matching delivery to show in an iframe. Ends in "Save as draft" or
  "Save & activate" (`PATCH .../automations/:id {status}`).
- **`/admin/clients/[realtorId]/automations/[automationId]`**: detail page —
  `GET .../automations/:id` + `GET .../automations/:id/runs`. Five cards
  (Status, Audience, Match Rules, Schedule, Email Template) each with an Edit
  action opening a modal around the same controlled editor component the
  wizard uses (`AudienceEditor`, `MatchRulesEditor`, `ScheduleEditor`,
  `EmailTemplateEditor` — see Shared components below), PATCHing just that
  field. "Edit details" (name/spreadsheet source) is a sixth, header-level
  action. "Run preview" / "Run now" call the same preview/run endpoints as the
  wizard.
- **`/admin/clients/[realtorId]/automations/[automationId]/runs/[runId]`**:
  one run's stats + its deliveries (`GET .../runs/:runId`, deliveries include
  populated buyer name/email). View a delivery's rendered email in a modal
  (`GET .../deliveries/:id/html`); retry a failed one
  (`POST .../deliveries/:id/retry`).
- **`/admin/clients/[realtorId]/settings`**: realtor profile form
  (`GET`/`PATCH /api/admin/clients/:realtorId`) plus the spreadsheet-connection
  panel — paste a sheet URL, preview its detected columns
  (`POST .../spreadsheets/preview`), connect it (`POST .../spreadsheets/connect`),
  and sync any connected sheet on demand (`POST .../spreadsheets/:id/sync`,
  shows created/updated/archived/duplicate counts and per-row errors).

### Shared components worth knowing about (`apps/web/components/`)
- `AdminShell.js` — the sidebar/mobile-drawer chrome wrapping every
  `/admin/clients/*` page; owns logout and the account-settings modal.
- `ScheduleEditor.js`, `AudienceEditor.js`, `MatchRulesEditor.js`,
  `EmailTemplateEditor.js` — each is a controlled `{value, onChange}` editor
  plus a `describeX()` one-line-summary helper, used identically by the
  wizard and by the automation detail page's edit modals — this is the one
  place in the app where the same form fields render in two different flows,
  so a change to a field belongs in the shared component, not the pages.
  `BuyerFieldsForm.js` is the buyer equivalent (used by the buyer list's "Add
  buyer" modal and the buyer detail page's Settings tab).
- `DeliveryHistoryAccordion.js` — the buyer detail page's send-history UI.
- `charts/TimeSeriesChart.js`, `charts/BreakdownBarChart.js` — the two
  Recharts wrappers every overview/analytics screen uses.

---

## Backend API (`apps/api/src/routes/`, mounted in `app.js`)

`requireAdminAuth` gates everything except `/health` and `/api/public/*`.
Every `/api/admin/clients/:realtorId/*` group additionally runs
`resolveRealtorParam`, which 404s on an invalid/unknown id before any
controller runs — this is the entire multi-tenant boundary.

| Method | Path | Controller | Notes |
|---|---|---|---|
| GET | `/health` | — | unauthenticated liveness check |
| POST | `/api/admin/auth/login` | `adminAuth.adminLogin` | rate-limited |
| POST | `/api/admin/auth/logout` | `adminAuth.adminLogout` | |
| GET | `/api/admin/auth/me` | `adminAuth.adminMe` | |
| PATCH | `/api/admin/auth/password` | `adminAuth.adminChangePassword` | rate-limited |
| GET | `/api/admin/overview` | `adminOverview.getAdminOverview` | the one intentionally cross-tenant read |
| GET | `/api/admin/clients` | `adminClients.listRealtors` | paginated, search |
| POST | `/api/admin/clients` | `adminClients.createRealtor` | optional inline spreadsheet connect |
| GET/PATCH | `/api/admin/clients/:realtorId` | `adminClients.{get,update}Realtor` | |
| GET | `.../buyers` | `buyers.listBuyers` | paginated, search, zip/status filter |
| POST | `.../buyers` | `buyers.createBuyer` | |
| GET/PATCH/DELETE | `.../buyers/:id` | `buyers.{get,update,delete}Buyer` | delete = soft archive |
| GET | `.../buyers/:id/deliveries` | `buyers.listBuyerDeliveries` | listings populated |
| GET | `.../buyers/:id/analytics` | `buyers.getBuyerAnalytics` | |
| GET | `.../spreadsheets` | `spreadsheets.listConnections` | |
| POST | `.../spreadsheets/preview` | `spreadsheets.preview` | no persistence |
| POST | `.../spreadsheets/connect` | `spreadsheets.connect` | |
| POST | `.../spreadsheets/:id/sync` | `spreadsheets.sync` | idempotent upsert |
| GET | `.../listings` | `listings.getListings` | `?zip=&beds=&maxPrice=`, provider-backed + cached |
| GET | `.../automations` | `automations.listAutomations` | paginated |
| POST | `.../automations` | `automations.createAutomation` | |
| GET/PATCH/DELETE | `.../automations/:id` | `automations.{get,update,delete}Automation` | update reschedules the cron job |
| POST | `.../automations/:id/preview` | `automations.previewAutomation` | dry run, 0 emails sent |
| POST | `.../automations/:id/run` | `automations.runAutomationNow` | real send; 409 if already running |
| GET | `.../automations/:id/runs` | `automations.listRunsForAutomation` | |
| GET | `.../runs` | `automations.listRunsForRealtor` | most recent N |
| GET | `.../runs/:runId` | `automations.getRun` | + its deliveries |
| GET | `.../deliveries/:id/html` | `deliveries.getDeliveryHtml` | |
| POST | `.../deliveries/:id/retry` | `deliveries.retryDelivery` | only a `failed` delivery |
| POST | `.../deliveries/:id/send-test` | `deliveries.sendTestEmail` | doesn't touch delivery status |
| GET | `.../overview` | `overview.getOverview` | realtor-scoped stats/charts |
| GET | `/api/public/unsubscribe/:token` | `public.checkUnsubscribeToken` | read-only |
| POST | `/api/public/unsubscribe/:token` | `public.unsubscribe` | |

(`.../` = `/api/admin/clients/:realtorId`)

---

## What's not wired up to anything (by design)

- `Realtor.usageLimit` / `notifications.enabled` — stored, editable from
  Settings, enforced nowhere yet (see `CLAUDE.md` "Post-launch" section).
- The old in-app conversation/inbox/inquiry system, `/l/:token`, `/t/:token`
  — deleted, not dormant. If you find a reference to them anywhere, it's
  stale documentation, not a hidden feature.
