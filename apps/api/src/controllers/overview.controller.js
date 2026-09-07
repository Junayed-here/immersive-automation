import * as buyersRepo from '../repositories/buyers.repo.js';
import * as automationsRepo from '../repositories/automations.repo.js';
import * as automationRunsRepo from '../repositories/automationRuns.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { lastNDays, bucketByDay } from '../utils/dateBuckets.js';

export const getOverview = asyncHandler(async function getOverview(req, res) {
  const { realtorId } = req;

  const [activeBuyers, archivedBuyers, automations, recentRuns, allRunsForChart, buyersForGrowth] = await Promise.all([
    buyersRepo.countByStatus(realtorId, 'active'),
    buyersRepo.countByStatus(realtorId, 'archived'),
    automationsRepo.findAllByRealtor(realtorId),
    automationRunsRepo.findByRealtorId(realtorId, 10),
    automationRunsRepo.findAllByRealtorId(realtorId),
    buyersRepo.findActiveForGrowth(realtorId),
  ]);

  const automationsByStatus = automations.reduce(
    (acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    { draft: 0, active: 0, paused: 0 }
  );

  const totals = allRunsForChart.reduce(
    (acc, run) => {
      acc.emailsSent += run.stats?.emailsSent || 0;
      acc.emailsFailed += run.stats?.emailsFailed || 0;
      acc.emailsSkipped += run.stats?.emailsSkipped || 0;
      return acc;
    },
    { emailsSent: 0, emailsFailed: 0, emailsSkipped: 0 }
  );

  const lastRunAt = automations.reduce((latest, a) => {
    if (!a.lastRunAt) return latest;
    return !latest || a.lastRunAt > latest ? a.lastRunAt : latest;
  }, null);

  const runsByDay = bucketByDay(allRunsForChart, 'createdAt');
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

  const buyersByDay = bucketByDay(buyersForGrowth, 'createdAt');
  let cumulativeBuyers = buyersForGrowth.filter((b) => new Date(b.createdAt) < new Date(lastNDays(30)[0])).length;
  const growthOverTime = lastNDays(30).map((date) => {
    cumulativeBuyers += (buyersByDay.get(date) || []).length;
    return { date, buyers: cumulativeBuyers };
  });

  const automationTotals = new Map();
  allRunsForChart.forEach((run) => {
    const key = String(run.automationId);
    automationTotals.set(key, (automationTotals.get(key) || 0) + (run.stats?.emailsSent || 0));
  });
  const automationBreakdown = automations
    .map((a) => ({ automationId: a._id, name: a.name, emailsSent: automationTotals.get(String(a._id)) || 0 }))
    .filter((a) => a.emailsSent > 0)
    .sort((a, b) => b.emailsSent - a.emailsSent);

  return ok(res, 200, {
    buyers: { active: activeBuyers, archived: archivedBuyers, total: activeBuyers + archivedBuyers, growthOverTime },
    automations: {
      total: automations.length,
      ...automationsByStatus,
      breakdown: automationBreakdown,
    },
    runs: {
      total: allRunsForChart.length,
      ...totals,
      lastRunAt,
      recent: recentRuns,
      sentOverTime,
    },
  });
});
