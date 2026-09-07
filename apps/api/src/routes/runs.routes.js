import { Router } from 'express';
import { getRun, listRunsForRealtor } from '../controllers/automations.controller.js';

export const runsRouter = Router();

runsRouter.get('/', listRunsForRealtor);
runsRouter.get('/:runId', getRun);
