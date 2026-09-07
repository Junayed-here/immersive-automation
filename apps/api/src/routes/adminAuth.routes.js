import { Router } from 'express';
import { adminLogin, adminLogout, adminMe, adminChangePassword } from '../controllers/adminAuth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { adminLoginSchema, adminChangePasswordSchema } from '../validators/adminAuth.validators.js';

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', authRateLimiter, validate(adminLoginSchema), adminLogin);
adminAuthRouter.post('/logout', adminLogout);
adminAuthRouter.get('/me', requireAdminAuth, adminMe);
adminAuthRouter.patch('/password', requireAdminAuth, authRateLimiter, validate(adminChangePasswordSchema), adminChangePassword);
