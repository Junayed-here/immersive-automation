import { Router } from 'express';
import {
  listAutomations,
  createAutomation,
  getAutomation,
  updateAutomation,
  deleteAutomation,
  previewAutomation,
  runAutomationNow,
  listRunsForAutomation,
} from '../controllers/automations.controller.js';
import { validate } from '../middleware/validate.js';
import { createAutomationSchema, updateAutomationSchema, listAutomationsQuerySchema } from '../validators/automation.validators.js';

export const automationsRouter = Router();

automationsRouter.get('/', validate(listAutomationsQuerySchema, 'query'), listAutomations);
automationsRouter.post('/', validate(createAutomationSchema), createAutomation);
automationsRouter.get('/:id', getAutomation);
automationsRouter.patch('/:id', validate(updateAutomationSchema), updateAutomation);
automationsRouter.delete('/:id', deleteAutomation);
automationsRouter.post('/:id/preview', previewAutomation);
automationsRouter.post('/:id/run', runAutomationNow);
automationsRouter.get('/:id/runs', listRunsForAutomation);
