import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb, disconnectDb } from './db/pool.js';
import { loadScheduledAutomations } from './jobs/scheduler.js';

async function main() {
  const connection = await connectDb();
  // eslint-disable-next-line no-console
  console.log(`Postgres connected: ${connection.name}`);

  await loadScheduledAutomations();

  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  async function shutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
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
