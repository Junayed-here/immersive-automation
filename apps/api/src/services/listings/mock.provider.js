import fs from 'node:fs';
import { env } from '../../config/env.js';
import { ListingProvider } from './provider.js';
import { normalizeMockListing } from './normalize.js';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * The only place in the codebase allowed to read data/listings.json directly.
 */
export class MockListingProvider extends ListingProvider {
  constructor() {
    super();
    const raw = fs.readFileSync(env.mockListingsPath, 'utf8');
    this.listings = JSON.parse(raw).map(normalizeMockListing);
  }

  async fetchByZip(zip) {
    await sleep(150);
    return this.listings.filter((listing) => listing.zip === zip && listing.status === 'for_sale');
  }

  async fetchById(providerId) {
    await sleep(150);
    return this.listings.find((listing) => listing.providerId === providerId) || null;
  }
}
