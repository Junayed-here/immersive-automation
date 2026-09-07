import { ListingProvider } from './provider.js';

/**
 * STUB ONLY. Zillow has no general public listings API - the real integration
 * ends up being an MLS/IDX feed, RESO Web API, or a licensed aggregator (see
 * master-plan.md §3). This exists so the factory/interface shape is correct
 * and ready to fill in later; it must never make a real HTTP call.
 */
export class ZillowProvider extends ListingProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async fetchByZip() {
    throw new Error('NotImplemented: ZillowProvider is a stub. Set LISTINGS_PROVIDER=mock.');
  }

  async fetchById() {
    throw new Error('NotImplemented: ZillowProvider is a stub. Set LISTINGS_PROVIDER=mock.');
  }
}
