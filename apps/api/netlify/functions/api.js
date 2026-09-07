import serverless from 'serverless-http';
import { createApp } from '../../src/app.js';

// createApp() is a pure factory (no .listen(), no DB connect - that happens
// lazily on first query via src/db/pool.js), so wrapping it here is the only
// change needed to serve the whole Express app as one Netlify Function.
export const handler = serverless(createApp());
