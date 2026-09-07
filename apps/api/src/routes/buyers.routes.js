import { Router } from 'express';
import {
  listBuyers,
  createBuyer,
  getBuyer,
  updateBuyer,
  deleteBuyer,
  listBuyerDeliveries,
  getBuyerAnalytics,
} from '../controllers/buyers.controller.js';
import { validate } from '../middleware/validate.js';
import {
  createBuyerSchema,
  updateBuyerSchema,
  listBuyersQuerySchema,
} from '../validators/buyer.validators.js';

export const buyersRouter = Router();

buyersRouter.get('/', validate(listBuyersQuerySchema, 'query'), listBuyers);
buyersRouter.post('/', validate(createBuyerSchema), createBuyer);
buyersRouter.get('/:id', getBuyer);
buyersRouter.get('/:id/deliveries', listBuyerDeliveries);
buyersRouter.get('/:id/analytics', getBuyerAnalytics);
buyersRouter.patch('/:id', validate(updateBuyerSchema), updateBuyer);
buyersRouter.delete('/:id', deleteBuyer);
