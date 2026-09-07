import * as adminsRepo from '../repositories/admins.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { signAuthToken, setAuthCookie, clearAuthCookie } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { ok, fail } from '../utils/respond.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

export const adminLogin = asyncHandler(async function adminLogin(req, res) {
  const { email, password } = req.body;

  const admin = await adminsRepo.findByEmailWithPassword(email);

  if (!admin || !(await adminsRepo.comparePassword(password, admin.passwordHash))) {
    return fail(res, 401, INVALID_CREDENTIALS_MESSAGE);
  }

  const token = signAuthToken(admin);
  setAuthCookie(res, token, env.adminCookieName);

  delete admin.passwordHash;
  return ok(res, 200, { token, admin }, 'Logged in.');
});

export const adminLogout = asyncHandler(async function adminLogout(req, res) {
  clearAuthCookie(res, env.adminCookieName);
  return ok(res, 200, null, 'Logged out.');
});

export const adminMe = asyncHandler(async function adminMe(req, res) {
  return ok(res, 200, { admin: req.admin });
});

export const adminChangePassword = asyncHandler(async function adminChangePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const admin = await adminsRepo.findByIdWithPassword(req.admin._id);
  if (!(await adminsRepo.comparePassword(currentPassword, admin.passwordHash))) {
    return fail(res, 401, 'Current password is incorrect.');
  }

  const passwordHash = await adminsRepo.hashPassword(newPassword);
  await adminsRepo.updatePasswordHash(admin._id, passwordHash);

  return ok(res, 200, null, 'Password updated.');
});
