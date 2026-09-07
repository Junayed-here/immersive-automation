import { query } from '../db/pool.js';

// express-rate-limit's default store is an in-memory Map, which only works
// inside one long-lived process. Each Netlify Function invocation (or
// concurrent warm instance) gets its own memory, so per-IP limits would
// silently stop meaning anything - CLAUDE.md requires the admin auth route
// stay tightly rate-limited. Backed by the same Postgres pool everything
// else already uses instead of adding Redis/a paid add-on just for this.
//
// Implements the subset of the express-rate-limit Store interface it
// actually calls: init, increment, decrement, resetKey.
export class PgRateLimitStore {
  constructor() {
    this.windowMs = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const windowStart = new Date(Math.floor(Date.now() / this.windowMs) * this.windowMs);
    const { rows } = await query(
      `insert into rate_limit_hits (key, window_start, count)
       values ($1, $2, 1)
       on conflict (key, window_start) do update set count = rate_limit_hits.count + 1
       returning count`,
      [key, windowStart]
    );
    return {
      totalHits: rows[0].count,
      resetTime: new Date(windowStart.getTime() + this.windowMs),
    };
  }

  async decrement(key) {
    const windowStart = new Date(Math.floor(Date.now() / this.windowMs) * this.windowMs);
    await query('update rate_limit_hits set count = greatest(count - 1, 0) where key = $1 and window_start = $2', [
      key,
      windowStart,
    ]);
  }

  async resetKey(key) {
    await query('delete from rate_limit_hits where key = $1', [key]);
  }
}
