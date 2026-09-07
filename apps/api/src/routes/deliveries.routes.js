import { Router } from 'express';
import { getDeliveryHtml, retryDelivery, sendTestEmail } from '../controllers/deliveries.controller.js';
import { validate } from '../middleware/validate.js';
import { sendTestEmailSchema } from '../validators/delivery.validators.js';

export const deliveriesRouter = Router();

deliveriesRouter.get('/:id/html', getDeliveryHtml);
deliveriesRouter.post('/:id/retry', retryDelivery);
deliveriesRouter.post('/:id/send-test', validate(sendTestEmailSchema), sendTestEmail);
