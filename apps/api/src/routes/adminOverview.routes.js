import { Router } from 'express';
import { getAdminOverview } from '../controllers/adminOverview.controller.js';

export const adminOverviewRouter = Router();

adminOverviewRouter.get('/', getAdminOverview);
