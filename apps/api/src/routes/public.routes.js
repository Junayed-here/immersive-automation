import { Router } from 'express';
import { unsubscribe, checkUnsubscribeToken } from '../controllers/public.controller.js';

export const publicRouter = Router();

publicRouter.get('/unsubscribe/:token', checkUnsubscribeToken);
publicRouter.post('/unsubscribe/:token', unsubscribe);
