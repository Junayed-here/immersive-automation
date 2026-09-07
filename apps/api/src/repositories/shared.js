// Maps a Postgres row (snake_case columns, jsonb columns already parsed into
// plain JS objects by `pg`) back into the exact camelCase/_id shape Mongoose
// documents used to produce, so controllers, the frontend, and every response
// payload stay unchanged by the migration underneath them.
function toCamelKey(key) {
  if (key === 'id') return '_id';
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function mapRow(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[toCamelKey(key)] = value;
  }
  return out;
}

export function mapRows(rows) {
  return rows.map(mapRow);
}

// Escapes LIKE/ILIKE metacharacters in a user-supplied search term so
// "50%" or "buyer_1" is matched literally, not as a wildcard pattern.
export function escapeLikeTerm(term) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function toJsonbParam(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}
