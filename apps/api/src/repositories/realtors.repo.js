import { query } from '../db/pool.js';
import { mapRow, mapRows, escapeLikeTerm, toJsonbParam } from './shared.js';

const DEFAULT_LICENSE = { verified: false, verifiedAt: null };
const DEFAULT_BROKERAGE = {};
const DEFAULT_PROFILE = {};
const DEFAULT_EMAIL_SETTINGS = { dailySendCap: 500 };
const DEFAULT_NOTIFICATIONS = { enabled: true };

// Realtors never log in themselves (see CLAUDE.md "Admin-managed model") so
// password_hash is always null in practice, but architecture rule #6 says it
// must never appear in a response regardless - omit it at the SQL level
// rather than relying on the frontend to ignore it, mirroring the old
// Mongoose `select: false` + toJSON transform.
const PUBLIC_COLUMNS = `
  id, email, first_name, last_name, phone, brokerage, license, profile,
  email_settings, usage_limit, notifications, status, created_at, updated_at
`;

function withFullName(realtor) {
  if (!realtor) return null;
  return { ...realtor, fullName: [realtor.firstName, realtor.lastName].filter(Boolean).join(' ') };
}

export async function list({ search, status, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(`%${escapeLikeTerm(search)}%`);
    const idx = params.length;
    conditions.push(`(first_name ilike $${idx} or last_name ilike $${idx} or email ilike $${idx})`);
  }

  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `select ${PUBLIC_COLUMNS} from realtors ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await query(`select count(*)::int as count from realtors ${where}`, params);

  return { realtors: mapRows(rows).map(withFullName), total: countRows[0].count };
}

// Admin-only cross-tenant read for the global overview dashboard.
export async function findAllActive() {
  const { rows } = await query(`select ${PUBLIC_COLUMNS} from realtors where status = 'active'`);
  return mapRows(rows).map(withFullName);
}

export async function create(fields) {
  const { rows } = await query(
    `insert into realtors (email, first_name, last_name, phone, license, brokerage)
     values ($1, $2, $3, $4, $5, $6)
     returning ${PUBLIC_COLUMNS}`,
    [
      fields.email,
      fields.firstName,
      fields.lastName,
      fields.phone ?? null,
      toJsonbParam({ ...DEFAULT_LICENSE, ...fields.license }),
      toJsonbParam({ ...DEFAULT_BROKERAGE, ...fields.brokerage }),
    ]
  );
  return withFullName(mapRow(rows[0]));
}

export async function findById(id) {
  const { rows } = await query(`select ${PUBLIC_COLUMNS} from realtors where id = $1`, [id]);
  return withFullName(mapRow(rows[0]));
}

// Mirrors the old shallow-merge-then-save controller pattern: for each
// top-level key being patched, jsonb fields are merged onto their current
// value; scalar fields are replaced outright.
export async function update(id, patch) {
  const current = await findById(id);
  if (!current) return null;

  const jsonbDefaults = {
    license: DEFAULT_LICENSE,
    brokerage: DEFAULT_BROKERAGE,
    profile: DEFAULT_PROFILE,
    emailSettings: DEFAULT_EMAIL_SETTINGS,
    notifications: DEFAULT_NOTIFICATIONS,
  };

  const columns = {
    email: 'email',
    firstName: 'first_name',
    lastName: 'last_name',
    phone: 'phone',
    usageLimit: 'usage_limit',
    status: 'status',
    license: 'license',
    brokerage: 'brokerage',
    profile: 'profile',
    emailSettings: 'email_settings',
    notifications: 'notifications',
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

  params.push(id);
  const { rows } = await query(
    `update realtors set ${sets.join(', ')}, updated_at = now() where id = $${params.length} returning ${PUBLIC_COLUMNS}`,
    params
  );
  return withFullName(mapRow(rows[0]));
}
