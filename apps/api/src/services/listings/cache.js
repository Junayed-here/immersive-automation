import * as listingsRepo from '../../repositories/listings.repo.js';
import { getListingProvider } from './index.js';

/**
 * Fetches a ZIP from the active provider and upserts the results into the
 * listings cache. Shared by the /api/listings route and the automation
 * runner so both paths cache identically.
 */
export async function fetchAndCacheByZip(zip) {
  const provider = getListingProvider();
  const listings = await provider.fetchByZip(zip);

  if (listings.length > 0) {
    await listingsRepo.bulkUpsert(listings);
  }

  return listings;
}

/**
 * Maps providerId -> cached Listing id, for building Delivery.listingIds
 * after matching has already selected NormalizedListing objects.
 */
export async function getListingIdMap(provider, providerIds) {
  return listingsRepo.findIdMapByProviderIds(provider, providerIds);
}
