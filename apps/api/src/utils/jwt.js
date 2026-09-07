import jwt from 'jsonwebtoken';
import { env, isProduction } from '../config/env.js';

export function signAuthToken(doc) {
  return jwt.sign({ sub: doc._id.toString() }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function setAuthCookie(res, token, cookieName = env.cookieName) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res, cookieName = env.cookieName) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
  });
}
