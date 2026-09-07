import * as buyersRepo from '../repositories/buyers.repo.js';
import * as deliveriesRepo from '../repositories/deliveries.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';
import { lastNDays, bucketByDay } from '../utils/dateBuckets.js';

export const listBuyers = asyncHandler(async function listBuyers(req, res) {
  const { search, zip, status, page = 1, limit = 20 } = req.query;

  const { buyers, total } = await buyersRepo.list({ realtorId: req.realtorId, search, zip, status, page, limit });

  const sentCounts = await deliveriesRepo.countSentListingsByBuyer(
    req.realtorId,
    buyers.map((b) => b._id)
  );
  const buyersWithCounts = buyers.map((b) => ({ ...b, sentListingsCount: sentCounts.get(b._id) || 0 }));

  return ok(res, 200, {
    buyers: buyersWithCounts,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const createBuyer = asyncHandler(async function createBuyer(req, res) {
  const buyer = await buyersRepo.create({
    ...req.body,
    realtorId: req.realtorId,
    source: 'manual',
  });

  return ok(res, 201, { buyer }, 'Buyer created.');
});

export const getBuyer = asyncHandler(async function getBuyer(req, res) {
  const buyer = await buyersRepo.findById(req.realtorId, req.params.id);

  if (!buyer) {
    return fail(res, 404, 'Buyer not found.');
  }

  return ok(res, 200, { buyer });
});

export const updateBuyer = asyncHandler(async function updateBuyer(req, res) {
  const buyer = await buyersRepo.update(req.realtorId, req.params.id, req.body);

  if (!buyer) {
    return fail(res, 404, 'Buyer not found.');
  }

  return ok(res, 200, { buyer }, 'Buyer updated.');
});

export const listBuyerDeliveries = asyncHandler(async function listBuyerDeliveries(req, res) {
  const buyer = await buyersRepo.findById(req.realtorId, req.params.id);
  if (!buyer) return fail(res, 404, 'Buyer not found.');

  const deliveries = await deliveriesRepo.findByBuyerId(req.realtorId, buyer._id);

  return ok(res, 200, { deliveries });
});

export const getBuyerAnalytics = asyncHandler(async function getBuyerAnalytics(req, res) {
  const buyer = await buyersRepo.findById(req.realtorId, req.params.id);
  if (!buyer) return fail(res, 404, 'Buyer not found.');

  const deliveries = await deliveriesRepo.findByBuyerId(req.realtorId, buyer._id);

  const totals = { sent: 0, skipped: 0, failed: 0, totalListingsReceived: 0 };
  const skipReasons = { no_matches: 0, unsubscribed: 0, cap_reached: 0 };
  deliveries.forEach((d) => {
    if (d.status === 'sent') {
      totals.sent += 1;
      totals.totalListingsReceived += d.listingIds.length;
    } else if (d.status === 'failed') {
      totals.failed += 1;
    } else if (d.status === 'skipped') {
      totals.skipped += 1;
      if (d.skipReason) skipReasons[d.skipReason] = (skipReasons[d.skipReason] || 0) + 1;
    }
  });

  const byDay = bucketByDay(deliveries, 'createdAt');
  const sentOverTime = lastNDays(30).map((date) => {
    const dayRecords = byDay.get(date) || [];
    return {
      date,
      sent: dayRecords.filter((d) => d.status === 'sent').length,
      skipped: dayRecords.filter((d) => d.status === 'skipped').length,
      failed: dayRecords.filter((d) => d.status === 'failed').length,
    };
  });

  const sortedByDate = [...deliveries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return ok(res, 200, {
    totals,
    skipReasons,
    sentOverTime,
    firstDeliveryAt: sortedByDate[0]?.createdAt || null,
    lastDeliveryAt: sortedByDate[sortedByDate.length - 1]?.createdAt || null,
  });
});

export const deleteBuyer = asyncHandler(async function deleteBuyer(req, res) {
  const buyer = await buyersRepo.archive(req.realtorId, req.params.id);

  if (!buyer) {
    return fail(res, 404, 'Buyer not found.');
  }

  return ok(res, 200, { buyer }, 'Buyer archived.');
});
