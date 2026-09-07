import { drainQueuedRuns } from '../../src/services/automation/runner.js';
import { env } from '../../src/config/env.js';

// Netlify Scheduled Functions (scheduler.js) have no public URL and can't be
// invoked over HTTP - only their own schedule can trigger them. This plain
// function exists so kickDrain() has something it can actually POST to for
// a fast manual "Run now"/"Preview" response instead of waiting for the next
// minute-tick. Gated by a shared secret since, unlike everything under
// /api/*, this bypasses the Express app's requireAdminAuth entirely.
export default async (request) => {
  if (!env.internalDrainSecret || request.headers.get('x-drain-secret') !== env.internalDrainSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { processed } = await drainQueuedRuns({ budgetMs: 8000 });
  return new Response(JSON.stringify({ processed }), {
    headers: { 'content-type': 'application/json' },
  });
};
