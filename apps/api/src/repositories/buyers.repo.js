import { query } from '../db/pool.js';
import { mapRow, mapRows, escapeLikeTerm, toJsonbParam } from './shared.js';

const DEFAULT_PREFERENCES = { zipCodes: [], homeType: [], listingType: 'buy' };
const DEFAULT_COMMUNICATION_PREFS = { smsOptIn: false, whatsappOptIn: false };

export async function list({ realtorId, search, zip, status, page = 1, limit = 20 }) {
  const conditions = ['realtor_id = $1'];
  const params = [realtorId];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  } else if (!status) {
    conditions.push(`status = 'active'`);
  }

  if (zip) {
    params.push(zip);
    conditions.push(`preferences -> 'zipCodes' ? $${params.length}`);
  }

  if (search) {
    params.push(`%${escapeLikeTerm(search)}%`);
    const idx = params.length;
    conditions.push(`(name ilike $${idx} or email ilike $${idx})`);
  }

  const where = `where ${conditions.join(' and ')}`;
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `select * from buyers ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`select count(*)::int as count from buyers ${where}`, params);

  return { buyers: mapRows(rows), total: countRows[0].count };
}

export async function create(fields) {
  const { rows } = await query(
    `insert into buyers (realtor_id, name, email, phone, preferences, communication_prefs, source, subscribed)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      fields.realtorId,
      fields.name,
      fields.email,
      fields.phone ?? null,
      toJsonbParam({ ...DEFAULT_PREFERENCES, ...fields.preferences }),
      toJsonbParam({ ...DEFAULT_COMMUNICATION_PREFS, ...fields.communicationPrefs }),
      fields.source || 'manual',
      fields.subscribed ?? true,
    ]
  );
  return mapRow(rows[0]);
}

export async function findById(realtorId, id) {
  const { rows } = await query('select * from buyers where id = $1 and realtor_id = $2', [id, realtorId]);
  return mapRow(rows[0]);
}

// Unscoped by realtorId - only used by the public unsubscribe flow, where
// identity comes from a signed per-buyer token rather than an admin session.
export async function findByIdUnscoped(id) {
  const { rows } = await query('select * from buyers where id = $1', [id]);
  return mapRow(rows[0]);
}

export async function setSubscribed(id, subscribed) {
  const { rows } = await query(
    'update buyers set subscribed = $2, updated_at = now() where id = $1 returning *',
    [id, subscribed]
  );
  return mapRow(rows[0]);
}

export async function findManyByIds(ids) {
  if (ids.length === 0) return [];
  const { rows } = await query('select * from buyers where id = any($1::uuid[])', [ids]);
  return mapRows(rows);
}

export async function update(realtorId, id, patch) {
  const current = await findById(realtorId, id);
  if (!current) return null;

  const jsonbDefaults = { preferences: DEFAULT_PREFERENCES, communicationPrefs: DEFAULT_COMMUNICATION_PREFS };
  const columns = {
    name: 'name',
    email: 'email',
    phone: 'phone',
    subscribed: 'subscribed',
    status: 'status',
    preferences: 'preferences',
    communicationPrefs: 'communication_prefs',
  };

  const sets = [];
  const params = [];
  Object.entries(patch).forEach(([key, value]) => {
    const column = columns[key];
    if (!column) return;
    params.push(
      jsonbDefaults[key] ? toJsonbParam({ ...jsonbDefaults[key], ...current[key], ...value }) : value
    );
    sets.push(`${column} = $${params.length}`);
  });
  if (sets.length === 0) return current;

  params.push(id, realtorId);
  const { rows } = await query(
    `update buyers set ${sets.join(', ')}, updated_at = now() where id = $${params.length - 1} and realtor_id = $${params.length} returning *`,
    params
  );
  return mapRow(rows[0]);
}

export async function archive(realtorId, id) {
  const { rows } = await query(
    `update buyers set status = 'archived', updated_at = now() where id = $1 and realtor_id = $2 returning *`,
    [id, realtorId]
  );
  return mapRow(rows[0]);
}

export async function updateLastEmailedAt(id) {
  await query('update buyers set last_emailed_at = now(), updated_at = now() where id = $1', [id]);
}

// Automation audience resolution - always scoped to active, subscribed
// buyers for the given realtor, per master-plan.
export async function resolveAudience(realtorId, audience) {
  const params = [realtorId];
  let extra = '';

  if (audience.type === 'buyerIds') {
    params.push(audience.value);
    extra = `and id = any($2::uuid[])`;
  } else if (audience.type === 'zipList') {
    params.push(audience.value);
    extra = `and preferences -> 'zipCodes' ?| $2::text[]`;
  }

  const { rows } = await query(
    `select * from buyers where realtor_id = $1 and status = 'active' and subscribed = true ${extra}`,
    params
  );
  return mapRows(rows);
}

export async function countActiveGlobal() {
  const { rows } = await query(`select count(*)::int as count from buyers where status = 'active'`);
  return rows[0].count;
}

export async function countByStatus(realtorId, status) {
  const { rows } = await query('select count(*)::int as count from buyers where realtor_id = $1 and status = $2', [
    realtorId,
    status,
  ]);
  return rows[0].count;
}

export async function findActiveForGrowth(realtorId) {
  const { rows } = await query(
    `select created_at from buyers where realtor_id = $1 and status = 'active'`,
    [realtorId]
  );
  return mapRows(rows);
}

// Spreadsheet sync - upsert-by-(realtor_id, email); the `||` jsonb merge
// leaves any existing preference subfield untouched when a row doesn't
// specify it, matching the old per-field dotted-path $set semantics.
export async function upsertFromSpreadsheetRow({ realtorId, spreadsheetConnectionId, row, preferencesPatch, sourceRowHash }) {
  const { rows } = await query(
    `insert into buyers (realtor_id, name, email, phone, preferences, communication_prefs, subscribed, source, spreadsheet_connection_id, source_row_hash, status)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'spreadsheet', $8, $9, 'active')
     on conflict (realtor_id, email) do update set
       name = excluded.name,
       phone = excluded.phone,
       preferences = coalesce(buyers.preferences, '{}'::jsonb) || excluded.preferences,
       communication_prefs = coalesce(buyers.communication_prefs, '{}'::jsonb) || excluded.communication_prefs,
       subscribed = excluded.subscribed,
       source = 'spreadsheet',
       spreadsheet_connection_id = excluded.spreadsheet_connection_id,
       source_row_hash = excluded.source_row_hash,
       status = 'active',
       updated_at = now()
     returning (xmax = 0) as inserted`,
    [
      realtorId,
      row.name,
      row.email,
      row.phone ?? null,
      toJsonbParam({ ...DEFAULT_PREFERENCES, ...preferencesPatch }),
      toJsonbParam({ smsOptIn: row.smsOptIn, whatsappOptIn: row.whatsappOptIn }),
      row.subscribed,
      spreadsheetConnectionId,
      sourceRowHash,
    ]
  );
  return rows[0].inserted;
}

export async function archiveMissingFromSync(realtorId, spreadsheetConnectionId, seenEmails) {
  const { rows } = await query(
    `update buyers set status = 'archived', updated_at = now()
     where realtor_id = $1 and spreadsheet_connection_id = $2 and status = 'active'
       and not (email = any($3::text[]))
     returning id`,
    [realtorId, spreadsheetConnectionId, seenEmails]
  );
  return rows.length;
}
