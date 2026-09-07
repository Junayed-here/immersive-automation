import * as buyersRepo from '../repositories/buyers.repo.js';
import { verifyUnsubscribeToken } from '../services/tokens.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';

function resolveBuyerFromToken(token) {
  let payload;
  try {
    payload = verifyUnsubscribeToken(token);
  } catch {
    return null;
  }
  return payload.buyerId;
}

// Read-only - lets the confirmation page show which address is about to be
// unsubscribed without the GET itself having a side effect (email-client link
// scanners/prefetchers fetch links automatically; a GET that unsubscribes
// would silently opt buyers out the moment their inbox scans the email).
export const checkUnsubscribeToken = asyncHandler(async function checkUnsubscribeToken(req, res) {
  const buyerId = resolveBuyerFromToken(req.params.token);
  if (!buyerId) return fail(res, 404, 'This link is invalid or has expired.', undefined, 'INVALID_TOKEN');

  const buyer = await buyersRepo.findByIdUnscoped(buyerId);
  if (!buyer) return fail(res, 404, 'Buyer not found.');

  return ok(res, 200, { email: buyer.email, alreadyUnsubscribed: !buyer.subscribed });
});

export const unsubscribe = asyncHandler(async function unsubscribe(req, res) {
  const buyerId = resolveBuyerFromToken(req.params.token);
  if (!buyerId) return fail(res, 404, 'This link is invalid or has expired.', undefined, 'INVALID_TOKEN');

  const buyer = await buyersRepo.setSubscribed(buyerId, false);
  if (!buyer) return fail(res, 404, 'Buyer not found.');

  return ok(res, 200, { email: buyer.email }, 'Unsubscribed.');
});
