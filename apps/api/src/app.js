import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { env } from './config/env.js';
import { adminAuthRouter } from './routes/adminAuth.routes.js';
import { adminClientsRouter } from './routes/adminClients.routes.js';
import { adminOverviewRouter } from './routes/adminOverview.routes.js';
import { buyersRouter } from './routes/buyers.routes.js';
import { spreadsheetsRouter } from './routes/spreadsheets.routes.js';
import { listingsRouter } from './routes/listings.routes.js';
import { automationsRouter } from './routes/automations.routes.js';
import { runsRouter } from './routes/runs.routes.js';
import { deliveriesRouter } from './routes/deliveries.routes.js';
import { overviewRouter } from './routes/overview.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { generalRateLimiter } from './middleware/rateLimit.js';
import { requireAdminAuth } from './middleware/adminAuth.js';
import { resolveRealtorParam } from './middleware/resolveRealtorParam.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Any real host (Netlify, Render, etc.) sits behind a reverse proxy, so
  // without this Express sees the proxy's IP for every request - breaking
  // per-IP rate limiting (all traffic shares one bucket) and req.ip logging.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.appUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  if (env.nodeEnv === 'development') {
    app.use(morgan('dev'));
  }

  app.use(generalRateLimiter);

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/overview', requireAdminAuth, adminOverviewRouter);
  app.use('/api/admin/clients', requireAdminAuth, adminClientsRouter);
  app.use('/api/admin/clients/:realtorId/buyers', requireAdminAuth, resolveRealtorParam, buyersRouter);
  app.use('/api/admin/clients/:realtorId/spreadsheets', requireAdminAuth, resolveRealtorParam, spreadsheetsRouter);
  app.use('/api/admin/clients/:realtorId/listings', requireAdminAuth, resolveRealtorParam, listingsRouter);
  app.use('/api/admin/clients/:realtorId/automations', requireAdminAuth, resolveRealtorParam, automationsRouter);
  app.use('/api/admin/clients/:realtorId/runs', requireAdminAuth, resolveRealtorParam, runsRouter);
  app.use('/api/admin/clients/:realtorId/deliveries', requireAdminAuth, resolveRealtorParam, deliveriesRouter);
  app.use('/api/admin/clients/:realtorId/overview', requireAdminAuth, resolveRealtorParam, overviewRouter);
  app.use('/api/public', publicRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
