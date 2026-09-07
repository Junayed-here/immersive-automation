import { Router } from 'express';
import { listRealtors, createRealtor, getRealtor, updateRealtor } from '../controllers/adminClients.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createRealtorSchema,
  updateRealtorSchema,
  listRealtorsQuerySchema,
} from '../validators/adminClients.validators.js';

export const adminClientsRouter = Router();

adminClientsRouter.get('/', validate(listRealtorsQuerySchema, 'query'), listRealtors);
adminClientsRouter.post('/', validate(createRealtorSchema), createRealtor);
adminClientsRouter.get('/:realtorId', getRealtor);
adminClientsRouter.patch('/:realtorId', validate(updateRealtorSchema), updateRealtor);
