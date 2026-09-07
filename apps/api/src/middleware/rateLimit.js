import rateLimit from 'express-rate-limit';
import { PgRateLimitStore } from './pgRateLimitStore.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore(),
  message: { success: false, error: { message: 'Too many auth requests, please try again later.' } },
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  store: new PgRateLimitStore(),
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
