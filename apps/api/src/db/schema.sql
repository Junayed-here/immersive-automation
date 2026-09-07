-- Realtor Listing Automation — Postgres schema (Supabase)
--
-- Run once against a fresh Supabase project (SQL editor, or `psql
-- "$DATABASE_URL" -f src/db/schema.sql`). Nested/flexible fields that the app
-- already treats as opaque blobs (preferences, matchRules, emailTemplate,
-- schedule, brokerage/license/profile/emailSettings, columnMapping,
-- lastSyncStats) are stored as jsonb, unchanged in shape from the old Mongoose
-- documents — the repositories map jsonb keys straight through as camelCase.
create extension if not exists pgcrypto;

create table admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table realtors (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text,
  first_name text not null,
  last_name text not null,
  phone text,
  brokerage jsonb not null default '{}',
  license jsonb not null default '{"verified": false, "verifiedAt": null}',
  profile jsonb not null default '{}',
  email_settings jsonb not null default '{"dailySendCap": 500}',
  usage_limit integer,
  notifications jsonb not null default '{"enabled": true}',
  status text not null default 'active' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table spreadsheet_connections (
  id uuid primary key default gen_random_uuid(),
  realtor_id uuid not null references realtors(id),
  sheet_url text not null,
  file_id text not null,
  gid text not null default '0',
  export_url text not null,
  column_mapping jsonb not null default '{}',
  last_synced_at timestamptz,
  last_sync_status text check (last_sync_status in ('ok', 'error', 'partial')),
  last_sync_stats jsonb not null default '{"rowsRead":0,"created":0,"updated":0,"archived":0,"duplicates":0,"errors":[]}',
  auto_sync boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (realtor_id, file_id, gid)
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mock', 'zillow')),
  provider_id text not null,
  zip text not null,
  address jsonb not null default '{}',
  price integer,
  bedrooms integer,
  -- double precision, not numeric: node-postgres returns `numeric` columns as
  -- strings (to avoid float rounding on money-like values), which would
  -- silently break `===`/numeric comparisons wherever a listing read back
  -- from this table is compared against a buyer's bathroom preference.
  bathrooms double precision,
  sqft integer,
  lot_size integer,
  year_built integer,
  property_type text,
  basement boolean,
  parking boolean,
  status text not null default 'for_sale' check (status in ('for_sale', 'pending', 'sold')),
  photos text[] not null default '{}',
  listing_url text,
  description text,
  fetched_at timestamptz not null default now(),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create index listings_zip_status_idx on listings (zip, status);

create table buyers (
  id uuid primary key default gen_random_uuid(),
  realtor_id uuid not null references realtors(id),
  name text not null,
  email text not null,
  phone text,
  -- basement/parking stay absent (no key) inside this jsonb when unset,
  -- preserving the tri-state undefined/true/false semantics that
  -- services/matching/engine.js depends on.
  preferences jsonb not null default '{"zipCodes":[],"homeType":[],"listingType":"buy"}',
  communication_prefs jsonb not null default '{"smsOptIn":false,"whatsappOptIn":false}',
  source text not null default 'manual' check (source in ('spreadsheet', 'manual')),
  spreadsheet_connection_id uuid references spreadsheet_connections(id),
  source_row_hash text,
  subscribed boolean not null default true,
  last_emailed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (realtor_id, email)
);

create index buyers_realtor_id_idx on buyers (realtor_id);
create index buyers_preferences_gin_idx on buyers using gin (preferences);

create table automations (
  id uuid primary key default gen_random_uuid(),
  realtor_id uuid not null references realtors(id),
  name text not null,
  spreadsheet_connection_id uuid references spreadsheet_connections(id),
  audience jsonb not null default '{"type":"all","value":[]}',
  match_rules jsonb not null default '{"bedrooms":"atLeast","bathrooms":"atLeast","familySize":{"enabled":true,"mode":"derivedBedrooms","sqftPerPerson":400},"maxPrice":null,"maxListingsPerBuyer":8,"excludePreviouslySent":true}',
  email_template jsonb not null default '{"subject":"New listings in {{zip}} for you, {{firstName}}","introHtml":"","ctaLabel":"View on Zillow","theme":{"accentColor":"#1a56db"}}',
  schedule jsonb not null default '{"mode":"manual","cron":null,"timezone":null}',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automations_realtor_id_idx on automations (realtor_id);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id),
  realtor_id uuid not null references realtors(id),
  trigger text not null check (trigger in ('manual', 'scheduled', 'preview')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'partial')),
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb not null default '{"zipsQueried":0,"listingsFetched":0,"buyersProcessed":0,"buyersMatched":0,"emailsSent":0,"emailsFailed":0,"emailsSkipped":0}',
  error jsonb not null default '{"message":null,"stack":null}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_runs_automation_id_created_at_idx on automation_runs (automation_id, created_at desc);
create index automation_runs_realtor_id_idx on automation_runs (realtor_id);
-- The direct Postgres equivalent of the Mongo partial unique index that
-- guarded run concurrency: only one 'running' row per automation, enforced
-- atomically by the database, not by an app-level read-then-write check.
create unique index automation_runs_running_uniq on automation_runs (automation_id) where (status = 'running');

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references automation_runs(id),
  automation_id uuid not null references automations(id),
  realtor_id uuid not null references realtors(id),
  buyer_id uuid not null references buyers(id),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  skip_reason text check (skip_reason in ('no_matches', 'unsubscribed', 'cap_reached')),
  rendered_html text,
  subject text,
  provider_message_id text,
  sent_at timestamptz,
  error jsonb not null default '{"message":null}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliveries_run_id_idx on deliveries (run_id);
create index deliveries_buyer_id_sent_at_idx on deliveries (buyer_id, sent_at desc);
create index deliveries_automation_id_buyer_id_idx on deliveries (automation_id, buyer_id);

-- Replaces Mongo's Delivery.listingIds array — a real join table since the
-- app already does populate-style joins and per-buyer/per-listing counts.
create table delivery_listings (
  delivery_id uuid not null references deliveries(id),
  listing_id uuid not null references listings(id),
  primary key (delivery_id, listing_id)
);
