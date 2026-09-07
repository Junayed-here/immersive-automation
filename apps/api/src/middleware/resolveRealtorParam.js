import * as realtorsRepo from '../repositories/realtors.repo.js';
import { asyncHandler } from './asyncHandler.js';
import { fail } from '../utils/respond.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Admin-nested routes act "as" a specific realtor, chosen via the :realtorId
 * route param rather than a realtor's own JWT. This sets req.realtor/
 * req.realtorId to the exact same contract requireAuth used to provide, so
 * every controller under it (buyers, spreadsheets, automations, etc.) needs
 * zero changes.
 */
export const resolveRealtorParam = asyncHandler(async function resolveRealtorParam(req, res, next) {
  const { realtorId } = req.params;

  if (!UUID_RE.test(realtorId)) {
    return fail(res, 404, 'Client not found.');
  }

  const realtor = await realtorsRepo.findById(realtorId);
  if (!realtor) {
    return fail(res, 404, 'Client not found.');
  }

  req.realtor = realtor;
  req.realtorId = realtor._id;
  return next();
});
