// Matches Listing.propertyType values (Zillow's homeType enum, reused as our
// internal vocabulary - see services/listings/normalize.js).
export const HOME_TYPES = ['SINGLE_FAMILY', 'CONDO', 'MULTI_FAMILY', 'TOWNHOUSE', 'LOT', 'MANUFACTURED'];

const ALIASES = {
  'single family': 'SINGLE_FAMILY',
  'single-family': 'SINGLE_FAMILY',
  house: 'SINGLE_FAMILY',
  condo: 'CONDO',
  condominium: 'CONDO',
  'multi family': 'MULTI_FAMILY',
  'multi-family': 'MULTI_FAMILY',
  duplex: 'MULTI_FAMILY',
  townhouse: 'TOWNHOUSE',
  'town house': 'TOWNHOUSE',
  land: 'LOT',
  lot: 'LOT',
  manufactured: 'MANUFACTURED',
  'mobile home': 'MANUFACTURED',
};

/**
 * Free text from a spreadsheet cell -> one of HOME_TYPES, or null if it
 * doesn't recognize the value (caller decides whether that's an error).
 */
export function normalizeHomeType(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;

  const asEnum = key.toUpperCase().replace(/[\s-]+/g, '_');
  if (HOME_TYPES.includes(asEnum)) return asEnum;

  return ALIASES[key] || null;
}
