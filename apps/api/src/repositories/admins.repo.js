import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { mapRow } from './shared.js';

const SALT_ROUNDS = 10;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(candidate, passwordHash) {
  return bcrypt.compare(candidate, passwordHash);
}

// Only these two functions select password_hash - every other read omits it,
// the SQL equivalent of Mongoose's `select: false`.
export async function findByEmailWithPassword(email) {
  const { rows } = await query('select * from admins where email = $1', [email]);
  return mapRow(rows[0]);
}

export async function findByIdWithPassword(id) {
  const { rows } = await query('select * from admins where id = $1', [id]);
  return mapRow(rows[0]);
}

export async function findById(id) {
  const { rows } = await query(
    'select id, email, name, created_at, updated_at from admins where id = $1',
    [id]
  );
  return mapRow(rows[0]);
}

export async function updatePasswordHash(id, passwordHash) {
  const { rows } = await query(
    `update admins set password_hash = $2, updated_at = now()
     where id = $1
     returning id, email, name, created_at, updated_at`,
    [id, passwordHash]
  );
  return mapRow(rows[0]);
}

export async function upsertByEmail({ email, passwordHash, name }) {
  const { rows } = await query(
    `insert into admins (email, password_hash, name)
     values ($1, $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash, name = excluded.name, updated_at = now()
     returning id, email, name, created_at, updated_at`,
    [email, passwordHash, name]
  );
  return mapRow(rows[0]);
}
