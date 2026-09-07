import pg from 'pg';
import { env } from '../config/env.js';

let pool;

function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.databaseUrl });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function getClient() {
  return getPool().connect();
}

export async function connectDb() {
  try {
    const { rows } = await query('select current_database() as name');
    return { name: rows[0].name };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `Failed to connect to Postgres. Is DATABASE_URL correct in your .env file?\n` +
        `Original error: ${err.message}`
    );
    process.exit(1);
  }
}

export async function disconnectDb() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
