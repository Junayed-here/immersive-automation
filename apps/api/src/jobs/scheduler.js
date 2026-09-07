import * as automationsRepo from '../repositories/automations.repo.js';
import { createRun } from '../services/automation/runner.js';
import { computeNextRunAt } from '../utils/cronNext.js';

// No live timers here - a serverless function can't keep an in-process
// scheduler alive between invocations. Instead this just queues due runs;
// apps/api/netlify/functions/scheduler.js (production) and the setInterval
// in server.js (local dev) both poll this on a fixed cadence, then drain the
// queue via drainQueuedRuns.
export async function queueDueCronAutomations() {
  const due = await automationsRepo.findDueCron();
  let queued = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const automation of due) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await createRun(automation._id, { trigger: 'scheduled' });
      queued += 1;
    } catch (err) {
      // RUN_IN_PROGRESS just means a previous tick's run for this automation
      // hasn't finished yet - leave next_run_at alone and try again next tick.
      if (err.code !== 'RUN_IN_PROGRESS') {
        // eslint-disable-next-line no-console
        console.error(`queueDueCronAutomations: failed to queue automation ${automation._id}:`, err.message);
      }
      // eslint-disable-next-line no-continue
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await refreshNextRunAt(automation);
  }

  return { queued };
}

async function refreshNextRunAt(automation) {
  const nextRunAt = computeNextRunAt(automation.schedule.cron, new Date(), automation.schedule.timezone);
  await automationsRepo.update(automation.realtorId, automation._id, { nextRunAt });
}

/**
 * Recomputes and persists next_run_at for one automation - call this any
 * time an automation's schedule/status changes (create/update) so the UI's
 * "next run" field and the due-query above stay accurate.
 */
export async function scheduleAutomation(automation) {
  const isCronSchedule = automation.status === 'active' && automation.schedule?.mode === 'cron' && automation.schedule?.cron;
  const nextRunAt = isCronSchedule ? computeNextRunAt(automation.schedule.cron, new Date(), automation.schedule.timezone) : null;

  if (String(automation.nextRunAt || '') !== String(nextRunAt || '')) {
    await automationsRepo.update(automation.realtorId, automation._id, { nextRunAt });
  }
}
