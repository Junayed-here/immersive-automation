import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/pool.js';
import { queueDueCronAutomations } from './jobs/scheduler.js';
import { drainQueuedRuns } from './services/automation/runner.js';

const SCHEDULER_POLL_MS = 60_000;

// Mirrors apps/api/netlify/functions/scheduler.js's job in production - a
// plain interval is fine here since this is a long-lived local process, not
// a serverless function needing an external scheduled trigger.
function pollAndDrain() {
  queueDueCronAutomations()
    .then(() => drainQueuedRuns({ budgetMs: 8000 }))
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Scheduler poll failed:', err.message);
    });
}

async function main() {
  const connection = await connectDb();
  // eslint-disable-next-line no-console
  console.log(`Postgres connected: ${connection.name}`);

  pollAndDrain();
  const pollTimer = setInterval(pollAndDrain, SCHEDULER_POLL_MS);

  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  async function shutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    clearInterval(pollTimer);
    server.close(async () => {
      await disconnectDb();
      // eslint-disable-next-line no-console
      console.log('Shutdown complete.');
      process.exit(0);
    });

    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
