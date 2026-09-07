import * as buyersRepo from '../../repositories/buyers.repo.js';
import * as realtorsRepo from '../../repositories/realtors.repo.js';
import * as automationsRepo from '../../repositories/automations.repo.js';
import * as automationRunsRepo from '../../repositories/automationRuns.repo.js';
import * as deliveriesRepo from '../../repositories/deliveries.repo.js';
import { query } from '../../db/pool.js';
import { fetchAndCacheByZip, getListingIdMap } from '../listings/cache.js';
import { matchListings } from '../matching/engine.js';
import { renderListingEmail } from '../email/templates/listingDigest.js';
import { sendMail } from '../email/transport.js';
import { runWithConcurrencyLimit } from '../../utils/concurrency.js';
import { signUnsubscribeToken, buildUnsubscribeUrl } from '../tokens.js';
import { env } from '../../config/env.js';
import { mapRow } from '../../repositories/shared.js';

const SEND_CONCURRENCY = 5;

function buildMatchRules(automation) {
  const { matchRules } = automation;
  return {
    bedrooms: matchRules.bedrooms,
    bathrooms: matchRules.bathrooms,
    familySize: matchRules.familySize?.enabled ? matchRules.familySize.mode : null,
    sqftPerPerson: matchRules.familySize?.sqftPerPerson,
    maxPrice: matchRules.maxPrice,
    maxListingsPerBuyer: matchRules.maxListingsPerBuyer,
  };
}

/**
 * Queues a run: validates preconditions and inserts the automation_runs row
 * (status 'queued', the schema default) but does none of the actual work -
 * that's executeRun's job, called later by drainQueuedRuns. Kept fast/cheap
 * on purpose so it's safe to await directly from an HTTP controller even on
 * a serverless function with a tight timeout.
 */
export async function createRun(automationId, { trigger = 'manual' } = {}) {
  const automation = await automationsRepo.findByIdUnscoped(automationId);
  if (!automation) {
    throw new Error('Automation not found.');
  }
  const dryRun = trigger === 'preview';
  if (!dryRun && automation.status !== 'active') {
    const err = new Error(
      'Automation must be active to run for real (it is currently draft/paused). Use preview instead.'
    );
    err.status = 400;
    err.code = 'AUTOMATION_NOT_ACTIVE';
    throw err;
  }

  try {
    return await automationRunsRepo.create({
      automationId: automation._id,
      realtorId: automation.realtorId,
      trigger,
      status: 'queued',
      startedAt: null,
    });
  } catch (createErr) {
    if (createErr.code === '23505') {
      const err = new Error(
        'This automation already has a run queued or in progress. Wait for it to finish before starting another.'
      );
      err.status = 409;
      err.code = 'RUN_IN_PROGRESS';
      throw err;
    }
    throw createErr;
  }
}

/**
 * Orchestrates one automation run per master-plan §6: collect unique ZIPs
 * once, fetch/cache each, run the pure matcher per buyer, render + (maybe)
 * send. A failure processing one buyer never aborts the run for the rest.
 * `run` must already exist (via createRun) with status 'queued'.
 */
async function executeRun(run, automation) {
  // trigger 'preview' is the only dry-run path today - every createRun call
  // site keeps these in lockstep, so there's no separate column for it.
  const dryRun = run.trigger === 'preview';
  await automationRunsRepo.update(run._id, { status: 'running', startedAt: new Date() });

  try {
    const realtor = await realtorsRepo.findById(automation.realtorId);
    const buyers = await buyersRepo.resolveAudience(automation.realtorId, automation.audience);
    const uniqueZips = [...new Set(buyers.flatMap((buyer) => buyer.preferences?.zipCodes || []))];

    const byZip = new Map();
    // eslint-disable-next-line no-restricted-syntax
    for (const zip of uniqueZips) {
      // eslint-disable-next-line no-await-in-loop
      byZip.set(zip, await fetchAndCacheByZip(zip));
    }
    const listingsFetched = [...byZip.values()].reduce((sum, arr) => sum + arr.length, 0);

    const rules = buildMatchRules(automation);

    let buyersMatched = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    let emailsSkipped = 0;

    const tasks = buyers.map((buyer) => async () => {
      try {
        const excludeListingIds = automation.matchRules.excludePreviouslySent
          ? await deliveriesRepo.findPreviouslySentProviderIds(automation._id, buyer._id)
          : [];

        const candidateListings = (buyer.preferences?.zipCodes || []).flatMap((zip) => byZip.get(zip) || []);
        const prefs = {
          zipCodes: buyer.preferences?.zipCodes,
          bedrooms: buyer.preferences?.bedrooms,
          bathrooms: buyer.preferences?.bathrooms,
          familySize: buyer.preferences?.familySize,
          basement: buyer.preferences?.basement,
          homeType: buyer.preferences?.homeType,
          parking: buyer.preferences?.parking,
          minSqft: buyer.preferences?.minSqft,
          minYearBuilt: buyer.preferences?.minYearBuilt,
          listingType: buyer.preferences?.listingType,
          excludeListingIds,
        };

        const matched = matchListings(candidateListings, prefs, rules);

        if (matched.length === 0) {
          await deliveriesRepo.create({
            runId: run._id,
            automationId: automation._id,
            realtorId: automation.realtorId,
            buyerId: buyer._id,
            status: 'skipped',
            skipReason: 'no_matches',
          });
          emailsSkipped += 1;
          return;
        }

        buyersMatched += 1;

        const idMap = await getListingIdMap(env.listingsProvider, matched.map((listing) => listing.providerId));
        const listingIds = matched.map((listing) => idMap.get(listing.providerId)).filter(Boolean);

        const initialStatus = dryRun ? 'skipped' : !buyer.subscribed ? 'skipped' : 'pending';
        const delivery = await deliveriesRepo.create({
          runId: run._id,
          automationId: automation._id,
          realtorId: automation.realtorId,
          buyerId: buyer._id,
          listingIds,
          status: initialStatus,
          skipReason: !dryRun && !buyer.subscribed ? 'unsubscribed' : null,
        });

        const unsubscribeUrl = buildUnsubscribeUrl(signUnsubscribeToken(buyer._id));
        const { subject, html } = renderListingEmail({
          realtor,
          client: buyer,
          listings: matched,
          automation,
          unsubscribeUrl,
        });

        if (dryRun || !buyer.subscribed) {
          await deliveriesRepo.update(delivery._id, { subject, renderedHtml: html });
          emailsSkipped += 1;
          return;
        }

        try {
          const info = await sendMail({
            to: buyer.email,
            subject,
            html,
            replyTo: realtor.emailSettings?.replyTo || realtor.email,
          });
          await deliveriesRepo.update(delivery._id, {
            subject,
            renderedHtml: html,
            status: 'sent',
            providerMessageId: info.messageId,
            sentAt: new Date(),
          });
          emailsSent += 1;
          await buyersRepo.updateLastEmailedAt(buyer._id);
        } catch (sendErr) {
          await deliveriesRepo.update(delivery._id, {
            subject,
            renderedHtml: html,
            status: 'failed',
            error: { message: sendErr.message },
          });
          emailsFailed += 1;
        }
      } catch (buyerErr) {
        emailsFailed += 1;
        await deliveriesRepo
          .create({
            runId: run._id,
            automationId: automation._id,
            realtorId: automation.realtorId,
            buyerId: buyer._id,
            status: 'failed',
            error: { message: buyerErr.message },
          })
          .catch(() => {});
      }
    });

    await runWithConcurrencyLimit(tasks, SEND_CONCURRENCY);

    const stats = {
      zipsQueried: uniqueZips.length,
      listingsFetched,
      buyersProcessed: buyers.length,
      buyersMatched,
      emailsSent,
      emailsFailed,
      emailsSkipped,
    };
    const status = emailsFailed > 0 ? 'partial' : 'completed';
    const finishedRun = await automationRunsRepo.update(run._id, { stats, status, finishedAt: new Date() });

    await automationsRepo.update(automation.realtorId, automation._id, { lastRunAt: new Date() });

    return finishedRun;
  } catch (err) {
    await automationRunsRepo.update(run._id, {
      status: 'failed',
      error: { message: err.message, stack: err.stack },
      finishedAt: new Date(),
    });
    throw err;
  }
}

// Claims the oldest queued run with a single atomic statement - `for update
// skip locked` means two overlapping callers (e.g. a manual kick landing at
// the same moment as the minute-tick scheduled poll) each get a different
// row instead of racing on the same one.
async function claimNextQueuedRun() {
  const { rows } = await query(
    `update automation_runs set status = 'running', started_at = now()
     where id = (
       select id from automation_runs where status = 'queued' order by created_at limit 1 for update skip locked
     )
     returning *`
  );
  return mapRow(rows[0]);
}

/**
 * Drains the run queue until it's empty or `budgetMs` elapses, whichever
 * comes first - leaving anything left over for the next call (the scheduled
 * function's next minute-tick is the backstop). Safe to call from a
 * long-lived local process on an interval or from a serverless function.
 */
export async function drainQueuedRuns({ budgetMs = 8000 } = {}) {
  const startedAt = Date.now();
  let processed = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - startedAt >= budgetMs) break;

    const run = await claimNextQueuedRun();
    if (!run) break;

    const automation = await automationsRepo.findByIdUnscoped(run.automationId);
    if (!automation) {
      // eslint-disable-next-line no-console
      console.error(`drainQueuedRuns: automation ${run.automationId} missing for run ${run._id} - marking failed.`);
      // eslint-disable-next-line no-await-in-loop
      await automationRunsRepo.update(run._id, {
        status: 'failed',
        error: { message: 'Automation no longer exists.' },
        finishedAt: new Date(),
      });
      // eslint-disable-next-line no-continue
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await executeRun(run, automation);
    } catch (err) {
      // executeRun already persists the failure onto the run row - just keep
      // draining the rest of the queue.
      // eslint-disable-next-line no-console
      console.error(`drainQueuedRuns: run ${run._id} failed:`, err.message);
    }
    processed += 1;
  }

  return { processed };
}
