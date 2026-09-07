import { isProduction } from '../config/env.js';
import { fail } from '../utils/respond.js';

export function notFoundHandler(req, res) {
  fail(res, 404, `No route for ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.code && typeof err.status === 'number') {
    return fail(res, err.status, err.message, err.details, err.code);
  }

  // Postgres unique_violation, not already handled by application code (e.g.
  // the automation-run concurrency guard, which throws its own 409 above).
  if (err.code === '23505') {
    const match = /Key \(([^)]+)\)/.exec(err.detail || '');
    const columns = match ? match[1].split(',').map((c) => c.trim()) : [];
    const field = columns.filter((c) => c !== 'realtor_id')[0] || columns[0] || 'field';
    return fail(res, 409, `A record with that ${field} already exists.`, [
      { field, message: 'Already in use' },
    ]);
  }

  const status = err.status || err.statusCode || 500;

  // eslint-disable-next-line no-console
  console.error(err);

  return fail(res, status, status >= 500 && isProduction ? 'Something went wrong.' : err.message);
}
