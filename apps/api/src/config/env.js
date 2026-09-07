import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

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
  // only ever the one bundled file. `process.env.NETLIFY` looked like the
  // right detection flag but is NOT actually set at function runtime
  // (confirmed live - it's build-time only); LAMBDA_TASK_ROOT is the real,
  // AWS-Lambda-guaranteed env var for "where the deployed code root is" -
  // Netlify Functions run on genuine Lambda underneath, so this is a
  // platform guarantee, not another guess. netlify.toml's `included_files`
  // bundles data/listings.json preserving its repo-root-relative path, which
  // LAMBDA_TASK_ROOT points at directly.
  mockListingsPath: process.env.LAMBDA_TASK_ROOT
    ? path.join(process.env.LAMBDA_TASK_ROOT, 'data/listings.json')
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
