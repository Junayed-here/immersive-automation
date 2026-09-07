import { queueDueCronAutomations } from '../../src/jobs/scheduler.js';
import { drainQueuedRuns } from '../../src/services/automation/runner.js';

// Runs every minute (Netlify Scheduled Function - see the `config` export
// below). Replaces the old in-process node-cron timers, which can't survive
// between stateless function invocations: this queues any cron automations
// that are due, then drains the run queue (both scheduled runs it just
// queued and anything queued by a manual "Run now"/"Preview" click since the
// last tick - see apps/api/src/utils/kickDrain.js for the fast path that
// invokes this function directly instead of waiting for the next tick).
export default async () => {
  const { queued } = await queueDueCronAutomations();
  const { processed } = await drainQueuedRuns({ budgetMs: 8000 });
  return new Response(JSON.stringify({ queued, processed }), {
    headers: { 'content-type': 'application/json' },
  });
};

export const config = { schedule: '* * * * *' };
