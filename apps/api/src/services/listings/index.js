import { env } from '../../config/env.js';
import { MockListingProvider } from './mock.provider.js';
import { ZillowProvider } from './zillow.provider.js';

let cachedMockProvider = null;

export function getListingProvider() {
  if (env.listingsProvider === 'zillow') {
    return new ZillowProvider(process.env.ZILLOW_API_KEY);
  }
  // Reuse one instance so data/listings.json is only read from disk once.
  cachedMockProvider ||= new MockListingProvider();
  return cachedMockProvider;
}
