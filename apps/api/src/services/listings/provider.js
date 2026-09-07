/**
 * @typedef {Object} NormalizedListing
 * @property {'mock'|'zillow'} provider
 * @property {string} providerId
 * @property {string} zip
 * @property {{line1:string,city:string,state:string,zip:string}} address
 * @property {number} price
 * @property {number} bedrooms
 * @property {number} bathrooms
 * @property {number} sqft
 * @property {number} lotSize
 * @property {number} yearBuilt
 * @property {string} propertyType
 * @property {boolean} [basement]
 * @property {boolean} [parking]
 * @property {'for_sale'|'pending'|'sold'} status
 * @property {string[]} photos
 * @property {string} listingUrl
 * @property {string} description
 * @property {Date} fetchedAt
 * @property {Object} raw
 */

/**
 * Contract every listing provider must satisfy. Everything downstream (routes,
 * the matching engine, tests) only ever sees NormalizedListing - swapping the
 * real provider in later should touch nothing outside this directory.
 */
export class ListingProvider {
  /**
   * @param {string} zip
   * @returns {Promise<NormalizedListing[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async fetchByZip(zip) {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} providerId
   * @returns {Promise<NormalizedListing|null>}
   */
  // eslint-disable-next-line no-unused-vars
  async fetchById(providerId) {
    throw new Error('Not implemented');
  }
}
