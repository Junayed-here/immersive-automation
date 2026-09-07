/**
 * Raw Zillow-shaped record -> NormalizedListing. Field names here are
 * deliberately generic (providerId, sqft) rather than Zillow-specific
 * (zpid, livingArea) so swapping in a real MLS/IDX/RESO feed later only
 * means writing a new normalize function, not touching any caller.
 */
export function normalizeMockListing(raw) {
  return {
    provider: 'mock',
    providerId: String(raw.zpid),
    zip: raw.address?.zip,
    address: raw.address,
    price: raw.price,
    bedrooms: raw.bedrooms,
    bathrooms: raw.bathrooms,
    sqft: raw.livingArea,
    lotSize: raw.lotSize,
    yearBuilt: raw.yearBuilt,
    propertyType: raw.propertyType,
    basement: raw.basement,
    parking: raw.parking,
    status: raw.status,
    photos: raw.photos || [],
    listingUrl: raw.listingUrl,
    description: raw.description,
    fetchedAt: new Date(),
    raw,
  };
}
