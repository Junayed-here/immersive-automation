import cron from 'node-cron';
import * as automationsRepo from '../repositories/automations.repo.js';
import { runAutomation } from '../services/automation/runner.js';
import { computeNextRunAt } from '../utils/cronNext.js';

const scheduledTasks = new Map();

async function refreshNextRunAt(automationId) {
  const automation = await automationsRepo.findByIdUnscoped(automationId);
  if (!automation || automation.schedule?.mode !== 'cron' || !cron.validate(automation.schedule.cron)) return;
  const nextRunAt = computeNextRunAt(automation.schedule.cron, new Date(), automation.schedule.timezone);
  await automationsRepo.update(automation.realtorId, automation._id, { nextRunAt });
}

function startTask(automation) {
  if (!cron.validate(automation.schedule.cron)) {
    // eslint-disable-next-line no-console
    console.error(`Scheduler: invalid cron "${automation.schedule.cron}" on automation ${automation._id} - skipping.`);
    return;
  }

  const options = automation.schedule.timezone ? { timezone: automation.schedule.timezone } : undefined;
  const task = cron.schedule(
    automation.schedule.cron,
    () => {
      runAutomation(automation._id, { trigger: 'scheduled', dryRun: false })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(`Scheduler: run failed for automation ${automation._id}:`, err.message);
        })
        .finally(() => refreshNextRunAt(automation._id));
    },
    options
  );

  scheduledTasks.set(String(automation._id), task);
}

export function unscheduleAutomation(automationId) {
  const key = String(automationId);
  const task = scheduledTasks.get(key);
  if (task) {
    task.stop();
    scheduledTasks.delete(key);
  }
}

/**
 * Registers (or re-registers) a single automation's cron job based on its
 * current status/schedule, and recomputes/persists nextRunAt so the UI has
 * something accurate to show. Call this any time an automation is created,
 * updated, or deleted so the in-memory schedule stays in sync - not just on
 * boot.
 */
export async function scheduleAutomation(automation) {
  unscheduleAutomation(automation._id);

  const isCronSchedule = automation.status === 'active' && automation.schedule?.mode === 'cron' && automation.schedule?.cron;

  if (isCronSchedule) {
    startTask(automation);
  }

  const nextRunAt =
    isCronSchedule && cron.validate(automation.schedule.cron)
      ? computeNextRunAt(automation.schedule.cron, new Date(), automation.schedule.timezone)
      : null;
  if (String(automation.nextRunAt || '') !== String(nextRunAt || '')) {
    await automationsRepo.update(automation.realtorId, automation._id, { nextRunAt });
  }
}

export async function loadScheduledAutomations() {
  const automations = await automationsRepo.findAllActiveCron();
  await Promise.all(automations.map(scheduleAutomation));
  // eslint-disable-next-line no-console
  console.log(`Scheduler: ${scheduledTasks.size} cron automation(s) loaded.`);
}

export function getScheduledCount() {
  return scheduledTasks.size;
}
