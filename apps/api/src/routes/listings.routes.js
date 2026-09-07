import { Router } from 'express';
import { getListings } from '../controllers/listings.controller.js';
import { validate } from '../middleware/validate.js';
import { listListingsQuerySchema } from '../validators/listing.validators.js';

export const listingsRouter = Router();

listingsRouter.get('/', validate(listListingsQuerySchema, 'query'), getListings);
