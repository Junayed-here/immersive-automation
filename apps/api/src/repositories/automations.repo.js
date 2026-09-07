import { query } from '../db/pool.js';
import { mapRow, mapRows, toJsonbParam } from './shared.js';

const DEFAULT_MATCH_RULES = {
  bedrooms: 'atLeast',
  bathrooms: 'atLeast',
  familySize: { enabled: true, mode: 'derivedBedrooms', sqftPerPerson: 400 },
  maxPrice: null,
  maxListingsPerBuyer: 8,
  excludePreviouslySent: true,
};

const DEFAULT_EMAIL_TEMPLATE = {
  subject: 'New listings in {{zip}} for you, {{firstName}}',
  introHtml: '',
  ctaLabel: 'View on Zillow',
  theme: { accentColor: '#1a56db' },
};

const DEFAULT_SCHEDULE = { mode: 'manual', cron: null, timezone: null };

export async function list({ realtorId, page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    'select * from automations where realtor_id = $1 order by created_at desc limit $2 offset $3',
    [realtorId, limit, offset]
  );
  const { rows: countRows } = await query('select count(*)::int as count from automations where realtor_id = $1', [
    realtorId,
  ]);
  return { automations: mapRows(rows), total: countRows[0].count };
}

export async function create(fields) {
  const { rows } = await query(
    `insert into automations (realtor_id, name, spreadsheet_connection_id, audience, match_rules, email_template, schedule, status)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8)
     returning *`,
    [
      fields.realtorId,
      fields.name,
      fields.spreadsheetConnectionId ?? null,
      toJsonbParam(fields.audience),
      toJsonbParam({ ...DEFAULT_MATCH_RULES, ...fields.matchRules }),
      toJsonbParam({ ...DEFAULT_EMAIL_TEMPLATE, ...fields.emailTemplate }),
      toJsonbParam({ ...DEFAULT_SCHEDULE, ...fields.schedule }),
      fields.status || 'draft',
    ]
  );
  return mapRow(rows[0]);
}

export async function findById(realtorId, id) {
  const { rows } = await query('select * from automations where id = $1 and realtor_id = $2', [id, realtorId]);
  return mapRow(rows[0]);
}

// Unscoped by realtorId - used internally by the runner/scheduler, which
// receive an automationId already resolved through a realtor-scoped lookup
// (the HTTP controller) or a system-wide cron query (the scheduler).
export async function findByIdUnscoped(id) {
  const { rows } = await query('select * from automations where id = $1', [id]);
  return mapRow(rows[0]);
}

export async function update(realtorId, id, patch) {
  const current = await findById(realtorId, id);
  if (!current) return null;

  const jsonbDefaults = {
    audience: {},
    matchRules: DEFAULT_MATCH_RULES,
    emailTemplate: DEFAULT_EMAIL_TEMPLATE,
    schedule: DEFAULT_SCHEDULE,
  };
  const columns = {
    name: 'name',
    spreadsheetConnectionId: 'spreadsheet_connection_id',
    status: 'status',
    lastRunAt: 'last_run_at',
    nextRunAt: 'next_run_at',
    audience: 'audience',
    matchRules: 'match_rules',
    emailTemplate: 'email_template',
    schedule: 'schedule',
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
    `update automations set ${sets.join(', ')}, updated_at = now() where id = $${params.length - 1} and realtor_id = $${params.length} returning *`,
    params
  );
  return mapRow(rows[0]);
}

export async function remove(realtorId, id) {
  const { rows } = await query('delete from automations where id = $1 and realtor_id = $2 returning *', [
    id,
    realtorId,
  ]);
  return mapRow(rows[0]);
}

export async function findAllByRealtor(realtorId) {
  const { rows } = await query('select * from automations where realtor_id = $1 order by created_at desc', [
    realtorId,
  ]);
  return mapRows(rows);
}

export async function findAllActiveCron() {
  const { rows } = await query(
    `select * from automations where status = 'active' and schedule ->> 'mode' = 'cron'`
  );
  return mapRows(rows);
}

export async function findAllStatuses() {
  const { rows } = await query('select status from automations');
  return mapRows(rows);
}

export async function findManyByIds(ids) {
  if (ids.length === 0) return [];
  const { rows } = await query('select * from automations where id = any($1::uuid[])', [ids]);
  return mapRows(rows);
}

// Admin-only cross-tenant read: the "needs attention" failing-automations
// widget, with the owning realtor's name attached.
export async function findManyByIdsWithRealtor(ids) {
  if (ids.length === 0) return [];
  const { rows } = await query(
    `select a.id, a.name, a.realtor_id, r.first_name as realtor_first_name, r.last_name as realtor_last_name
     from automations a join realtors r on r.id = a.realtor_id
     where a.id = any($1::uuid[])`,
    [ids]
  );
  return rows.map((row) => ({
    _id: row.id,
    name: row.name,
    realtorId: { _id: row.realtor_id, firstName: row.realtor_first_name, lastName: row.realtor_last_name },
  }));
}
