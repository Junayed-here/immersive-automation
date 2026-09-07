import { drainQueuedRuns } from '../services/automation/runner.js';
import { env } from '../config/env.js';

// Called right after createRun() so a manual "Run now"/"Preview" click
// doesn't have to wait for the next minute-tick poll to start.
//
// On Netlify, the Scheduled Function (netlify/functions/scheduler.js) has no
// public URL - only its own schedule can invoke it - so the fast path here
// hits a separate plain HTTP function (netlify/functions/drain.js) that
// shares the same drainQueuedRuns() logic. This function's own execution
// environment can also freeze the instant it sends its HTTP response, so the
// call is awaited just long enough to know the request was sent, not for the
// drain itself to finish. The 1-minute scheduled poll is the backstop if
// this fetch fails, times out, or the drain function is mid-cold-start.
//
// Locally, server.js is a long-lived process, so there's no freeze-on-return
// risk - draining in-process (unawaited) is both simpler and faster.
export async function kickDrain() {
  if (process.env.NETLIFY) {
    const base = process.env.URL || '';
    await fetch(`${base}/.netlify/functions/drain`, {
      method: 'POST',
      headers: { 'x-drain-secret': env.internalDrainSecret || '' },
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
    return;
  }

  drainQueuedRuns({ budgetMs: 8000 }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('kickDrain: local drain failed:', err.message);
  });
}
