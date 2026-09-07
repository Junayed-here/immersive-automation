const TERMINAL_STATUSES = new Set(['completed', 'partial', 'failed']);

// Automation runs are queued and drained asynchronously now (see
// apps/api/src/services/automation/runner.js) instead of the API awaiting
// the whole thing before responding - callers that need the finished run
// (preview stats, a rendered delivery) poll for it here instead.
export async function waitForRunCompletion(scoped, runId, { intervalMs = 1500, timeoutMs = 60000 } = {}) {
  const startedAt = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { run, deliveries } = await scoped.get(`/runs/${runId}`);
    if (TERMINAL_STATUSES.has(run.status)) {
      return { run, deliveries };
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for the run to finish.');
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
