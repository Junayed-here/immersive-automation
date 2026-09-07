import * as realtorsRepo from '../repositories/realtors.repo.js';
import * as buyersRepo from '../repositories/buyers.repo.js';
import * as automationsRepo from '../repositories/automations.repo.js';
import * as automationRunsRepo from '../repositories/automationRuns.repo.js';
import * as spreadsheetConnectionsRepo from '../repositories/spreadsheetConnections.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { lastNDays, bucketByDay } from '../utils/dateBuckets.js';

// The one intentionally cross-tenant read in the system - everything else is
// scoped by realtorId via resolveRealtorParam. This is the Admin's own view
// across every client, not a client acting on another client's data.
export const getAdminOverview = asyncHandler(async function getAdminOverview(req, res) {
  const [realtors, activeBuyers, automationStatuses, allRuns, recentRuns, erroredSheets] = await Promise.all([
    realtorsRepo.findAllActive(),
    buyersRepo.countActiveGlobal(),
    automationsRepo.findAllStatuses(),
    automationRunsRepo.findAllForOverview(),
    automationRunsRepo.findRecentForOverview(15),
    spreadsheetConnectionsRepo.listErrored(),
  ]);
  const totalRealtors = realtors.length;

  const automationsByStatus = automationStatuses.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    { draft: 0, active: 0, paused: 0 }
  );

  const totals = allRuns.reduce(
    (acc, run) => {
      acc.emailsSent += run.stats?.emailsSent || 0;
      acc.emailsFailed += run.stats?.emailsFailed || 0;
      acc.emailsSkipped += run.stats?.emailsSkipped || 0;
      return acc;
    },
    { emailsSent: 0, emailsFailed: 0, emailsSkipped: 0 }
  );

  // allRuns is sorted newest-first, so the first run seen per automationId is
  // that automation's latest - cheaper than a second grouped query.
  const seenAutomations = new Set();
  const failingAutomationIds = [];
  allRuns.forEach((run) => {
    const key = String(run.automationId);
    if (seenAutomations.has(key)) return;
    seenAutomations.add(key);
    if (run.status === 'failed' || run.status === 'partial') failingAutomationIds.push(run.automationId);
  });

  const failingAutomations = await automationsRepo.findManyByIdsWithRealtor(failingAutomationIds);

  const runsByDay = bucketByDay(allRuns, 'createdAt');
  const sentOverTime = lastNDays(30).map((date) => {
    const dayRuns = runsByDay.get(date) || [];
    return dayRuns.reduce(
      (acc, run) => {
        acc.emailsSent += run.stats?.emailsSent || 0;
        acc.emailsFailed += run.stats?.emailsFailed || 0;
        acc.emailsSkipped += run.stats?.emailsSkipped || 0;
        return acc;
      },
      { date, emailsSent: 0, emailsFailed: 0, emailsSkipped: 0 }
    );
  });

  const realtorTotals = new Map();
  allRuns.forEach((run) => {
    const key = String(run.realtorId);
    realtorTotals.set(key, (realtorTotals.get(key) || 0) + (run.stats?.emailsSent || 0));
  });
  const byRealtor = realtors
    .map((r) => ({ realtorId: r._id, name: `${r.firstName} ${r.lastName}`, emailsSent: realtorTotals.get(String(r._id)) || 0 }))
    .filter((r) => r.emailsSent > 0)
    .sort((a, b) => b.emailsSent - a.emailsSent);

  return ok(res, 200, {
    realtors: { active: totalRealtors },
    buyers: { active: activeBuyers },
    automations: { total: automationStatuses.length, ...automationsByStatus },
    runs: { total: allRuns.length, ...totals, recent: recentRuns, sentOverTime },
    byRealtor,
    needsAttention: {
      failingAutomations,
      erroredSheets,
    },
  });
});
