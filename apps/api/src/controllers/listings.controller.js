import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok } from '../utils/respond.js';
import { fetchAndCacheByZip } from '../services/listings/cache.js';

export const getListings = asyncHandler(async function getListings(req, res) {
  const { zip, beds, maxPrice } = req.query;

  const listings = await fetchAndCacheByZip(zip);

  let filtered = listings;
  if (beds !== undefined) filtered = filtered.filter((listing) => listing.bedrooms >= beds);
  if (maxPrice !== undefined) filtered = filtered.filter((listing) => listing.price <= maxPrice);

  return ok(res, 200, { listings: filtered });
});
