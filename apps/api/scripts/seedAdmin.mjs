import { connectDb, disconnectDb } from '../src/db/pool.js';
import * as adminsRepo from '../src/repositories/admins.repo.js';

/**
 * There's no self-serve way to create the first admin (by design - only
 * Admin can create accounts in this system). Run with:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... ADMIN_NAME="Your Name" node scripts/seedAdmin.mjs
 * Safe to re-run - upserts by email and updates the password if it already exists.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables and re-run.');
    process.exit(1);
  }

  await connectDb();

  const passwordHash = await adminsRepo.hashPassword(password);
  const admin = await adminsRepo.upsertByEmail({ email: email.toLowerCase().trim(), passwordHash, name });

  console.log(`Admin ready: ${admin.email}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
