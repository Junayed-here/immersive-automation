import rateLimit from 'express-rate-limit';
import { PgRateLimitStore } from './pgRateLimitStore.js';

// express-rate-limit's default keyGenerator reads req.ip and throws
// (ERR_ERL_UNDEFINED_IP_ADDRESS) if it's undefined - which it is on Netlify,
// since serverless-http's translation of the platform's Lambda-style event
// into an Express request doesn't populate it the way `trust proxy` expects.
// A custom keyGenerator bypasses that built-in validation entirely (it only
// runs inside the default one), so we read Netlify's own client-IP header
// directly instead of relying on req.ip.
function clientIp(req) {
  return (
    req.headers['x-nf-client-connection-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  store: new PgRateLimitStore(),
  message: { success: false, error: { message: 'Too many auth requests, please try again later.' } },
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  store: new PgRateLimitStore(),
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
