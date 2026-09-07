/**
 * matchListings - the heart of the product. PURE function: no DB, no network,
 * no Date.now(), no mutation of any input. Same inputs -> same output, always.
 *
 * @param {import('../listings/provider.js').NormalizedListing[]} listings
 * @param {{zipCodes?: string[], bedrooms?: number, bathrooms?: number, familySize?: number,
 *          basement?: boolean, homeType?: string[], parking?: boolean, minSqft?: number,
 *          minYearBuilt?: number, listingType?: 'buy'|'rent', excludeListingIds?: string[]}} prefs
 * @param {{bedrooms?: 'exact'|'atLeast'|'atLeastMinusOne', bathrooms?: 'exact'|'atLeast'|'atLeastMinusOne',
 *          familySize?: 'derivedBedrooms'|'minSqft'|null, sqftPerPerson?: number, maxPrice?: number|null,
 *          maxListingsPerBuyer?: number}} rules
 * @returns {import('../listings/provider.js').NormalizedListing[]}
 */
export function matchListings(listings, prefs = {}, rules = {}) {
  const zipCodes = prefs.zipCodes || [];
  const excludeListingIds = prefs.excludeListingIds || [];

  // 1. ZIP - exact string match, always applied.
  let results = listings.filter((listing) => zipCodes.includes(listing.zip));

  // 2. Status - for_sale only.
  results = results.filter((listing) => listing.status === 'for_sale');

  // 3. Bedrooms - skipped entirely if the buyer has no bedroom preference.
  if (prefs.bedrooms !== undefined && prefs.bedrooms !== null) {
    const mode = rules.bedrooms || 'atLeast';
    results = results.filter((listing) => {
      if (mode === 'exact') return listing.bedrooms === prefs.bedrooms;
      if (mode === 'atLeastMinusOne') return listing.bedrooms >= prefs.bedrooms - 1;
      return listing.bedrooms >= prefs.bedrooms;
    });
  }

  // 3b. Bathrooms - same shape as bedrooms, skipped if unset.
  if (prefs.bathrooms !== undefined && prefs.bathrooms !== null) {
    const mode = rules.bathrooms || 'atLeast';
    results = results.filter((listing) => {
      if (mode === 'exact') return listing.bathrooms === prefs.bathrooms;
      if (mode === 'atLeastMinusOne') return listing.bathrooms >= prefs.bathrooms - 1;
      return listing.bathrooms >= prefs.bathrooms;
    });
  }

  // 4. Family size - only applied when both the rule mode and the buyer's
  // family size are set; otherwise this axis is skipped entirely.
  if (rules.familySize && prefs.familySize !== undefined && prefs.familySize !== null) {
    if (rules.familySize === 'derivedBedrooms') {
      const requiredBedrooms = Math.ceil(prefs.familySize / 2);
      results = results.filter((listing) => listing.bedrooms >= requiredBedrooms);
    } else if (rules.familySize === 'minSqft') {
      const sqftPerPerson = rules.sqftPerPerson || 400;
      const requiredSqft = prefs.familySize * sqftPerPerson;
      results = results.filter((listing) => listing.sqft >= requiredSqft);
    }
  }

  // 5. Basement - exact boolean match, skipped if the buyer has no preference.
  if (prefs.basement !== undefined && prefs.basement !== null) {
    results = results.filter((listing) => listing.basement === prefs.basement);
  }

  // 6. Home type - listing's propertyType must be in the buyer's list, when non-empty.
  if (prefs.homeType && prefs.homeType.length > 0) {
    const homeTypeSet = new Set(prefs.homeType);
    results = results.filter((listing) => homeTypeSet.has(listing.propertyType));
  }

  // 7. Parking - exact boolean match, skipped if the buyer has no preference.
  if (prefs.parking !== undefined && prefs.parking !== null) {
    results = results.filter((listing) => listing.parking === prefs.parking);
  }

  // 8. Minimum square footage - independent of the familySize/minSqft rule above.
  if (prefs.minSqft !== undefined && prefs.minSqft !== null) {
    results = results.filter((listing) => listing.sqft >= prefs.minSqft);
  }

  // 9. Minimum year built.
  if (prefs.minYearBuilt !== undefined && prefs.minYearBuilt !== null) {
    results = results.filter((listing) => listing.yearBuilt >= prefs.minYearBuilt);
  }

  // 10. Listing type - 'buy' matches today's for-sale-only inventory (already
  // guaranteed by the status filter above); 'rent' matches nothing until
  // rental inventory exists. Undefined/'buy' is the default, so this only
  // ever excludes listings for a buyer who explicitly wants to rent.
  if (prefs.listingType === 'rent') {
    results = [];
  }

  // 11. Max price.
  if (rules.maxPrice !== undefined && rules.maxPrice !== null) {
    results = results.filter((listing) => listing.price <= rules.maxPrice);
  }

  // 12. Exclusions (e.g. previously-sent listings, computed by the caller).
  if (excludeListingIds.length > 0) {
    const excludeSet = new Set(excludeListingIds);
    results = results.filter((listing) => !excludeSet.has(listing.providerId));
  }

  // 13. Sort by price ascending. Spread first so we never sort (mutate) an
  // array that might alias caller-owned state.
  results = [...results].sort((a, b) => a.price - b.price);

  // 14. Cap.
  if (typeof rules.maxListingsPerBuyer === 'number' && rules.maxListingsPerBuyer >= 0) {
    results = results.slice(0, rules.maxListingsPerBuyer);
  }

  return results;
}
