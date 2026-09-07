import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

// A deployed run crashed with `ENOENT ... '/data/listings.json'`, proving
// process.cwd() there is '/', not /var/task as commonly assumed - so that's
// out. import.meta.url (tried next) also isn't safe: Netlify's bundler
// doesn't consistently produce ESM output (one deploy wrapped this in a CJS
// require() shim, where import.meta doesn't exist at all, crashing every
// request). /var/task is the one constant every AWS-Lambda-based platform
// (Netlify Functions included) uses as the deployment package root
// regardless of module format or how esbuild happened to bundle this run -
// hardcoding it has fewer moving parts than deriving it dynamically.
const NETLIFY_REPO_ROOT = '/var/task';

const required = ['DATABASE_URL', 'JWT_SECRET', 'LINK_SECRET'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy apps/api/.env.example to apps/api/.env and fill them in.'
  );
  process.exit(1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'token',
  adminCookieName: process.env.ADMIN_COOKIE_NAME || 'admin_token',
  linkSecret: process.env.LINK_SECRET,
  sheetFetcher: process.env.SHEET_FETCHER || 'local',
  spreadsheetFixturesDir: path.resolve(
    process.cwd(),
    process.env.SPREADSHEET_FIXTURES_DIR || '../../data/fixtures'
  ),
  listingsProvider: process.env.LISTINGS_PROVIDER || 'mock',
  // MOCK_LISTINGS_PATH (the "point this at listings-real.json for manual
  // testing" escape hatch) is a local-dev-only concept - on Netlify there's
  // only ever the one bundled file, at NETLIFY_REPO_ROOT (see above).
  mockListingsPath: process.env.NETLIFY
    ? path.join(NETLIFY_REPO_ROOT, 'data/listings.json')
    : path.resolve(process.cwd(), process.env.MOCK_LISTINGS_PATH || '../../data/listings.json'),
  mailTransport: process.env.MAIL_TRANSPORT || 'smtp',
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT) || 1025,
  smtpUser: process.env.SMTP_USER || null,
  smtpPass: process.env.SMTP_PASSWORD || null,
  mailFrom: process.env.MAIL_FROM || 'Listing Bot <noreply@localhost>',
  // Shared secret between kickDrain() and netlify/functions/drain.js so that
  // plain HTTP function (unlike the schedule-only scheduler function) isn't
  // wide open to the public internet. Unused/unchecked locally.
  internalDrainSecret: process.env.INTERNAL_DRAIN_SECRET || null,
};

export const isProduction = env.nodeEnv === 'production';
