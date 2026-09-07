import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import * as adminsRepo from '../repositories/admins.repo.js';
import { asyncHandler } from './asyncHandler.js';
import { fail } from '../utils/respond.js';

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  if (req.cookies && req.cookies[env.adminCookieName]) {
    return req.cookies[env.adminCookieName];
  }
  return null;
}

export const requireAdminAuth = asyncHandler(async function requireAdminAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return fail(res, 401, 'Authentication required.');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return fail(res, 401, 'Invalid or expired token.');
  }

  const admin = await adminsRepo.findById(payload.sub);
  if (!admin) {
    return fail(res, 401, 'Invalid or expired token.');
  }

  req.admin = admin;
  req.adminId = admin._id;
  return next();
});
