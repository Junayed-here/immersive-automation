import { query } from '../db/pool.js';
import { mapRow, mapRows, toJsonbParam } from './shared.js';

// Propagates the raw pg error on a unique-violation (code '23505') so
// services/automation/runner.js can turn it into a 409 RUN_IN_PROGRESS - the
// Postgres equivalent of Mongo's partial-unique-index dup-key code 11000.
export async function create({ automationId, realtorId, trigger, status, startedAt }) {
  const { rows } = await query(
    `insert into automation_runs (automation_id, realtor_id, trigger, status, started_at)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [automationId, realtorId, trigger, status, startedAt]
  );
  return mapRow(rows[0]);
}

export async function update(id, patch) {
  const columns = {
    status: 'status',
    startedAt: 'started_at',
    finishedAt: 'finished_at',
    stats: 'stats',
    error: 'error',
  };
  const jsonbFields = new Set(['stats', 'error']);

  const sets = [];
  const params = [];
  Object.entries(patch).forEach(([key, value]) => {
    const column = columns[key];
    if (!column) return;
    params.push(jsonbFields.has(key) ? toJsonbParam(value) : value);
    sets.push(`${column} = $${params.length}`);
  });
  if (sets.length === 0) return null;

  params.push(id);
  const { rows } = await query(
    `update automation_runs set ${sets.join(', ')}, updated_at = now() where id = $${params.length} returning *`,
    params
  );
  return mapRow(rows[0]);
}

export async function findById(realtorId, id) {
  const { rows } = await query('select * from automation_runs where id = $1 and realtor_id = $2', [id, realtorId]);
  return mapRow(rows[0]);
}

export async function findByAutomationId(automationId) {
  const { rows } = await query(
    'select * from automation_runs where automation_id = $1 order by created_at desc',
    [automationId]
  );
  return mapRows(rows);
}

export async function findAllByRealtorId(realtorId) {
  const { rows } = await query(
    'select id, stats, status, trigger, created_at, automation_id from automation_runs where realtor_id = $1',
    [realtorId]
  );
  return mapRows(rows);
}

export async function findByRealtorId(realtorId, limit) {
  const { rows } = await query(
    `select ar.*, a.name as automation_name
     from automation_runs ar
     join automations a on a.id = ar.automation_id
     where ar.realtor_id = $1
     order by ar.created_at desc
     limit $2`,
    [realtorId, limit]
  );
  return rows.map((row) => ({ ...mapRow(row), automationId: { _id: row.automation_id, name: row.automation_name } }));
}

// Admin-only cross-tenant reads for the global overview dashboard.
export async function findAllForOverview() {
  const { rows } = await query(
    `select id, stats, status, trigger, automation_id, realtor_id, created_at
     from automation_runs order by created_at desc`
  );
  return mapRows(rows);
}

export async function findRecentForOverview(limit) {
  const { rows } = await query(
    `select ar.id, ar.stats, ar.status, ar.trigger, ar.created_at, ar.automation_id, ar.realtor_id,
            a.name as automation_name, r.first_name as realtor_first_name, r.last_name as realtor_last_name
     from automation_runs ar
     join automations a on a.id = ar.automation_id
     join realtors r on r.id = ar.realtor_id
     order by ar.created_at desc
     limit $1`,
    [limit]
  );
  return rows.map((row) => ({
    ...mapRow(row),
    automationId: { _id: row.automation_id, name: row.automation_name },
    realtorId: { _id: row.realtor_id, firstName: row.realtor_first_name, lastName: row.realtor_last_name },
  }));
}
