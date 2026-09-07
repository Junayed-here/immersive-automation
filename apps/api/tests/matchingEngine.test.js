import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchListings } from '../src/services/matching/engine.js';

function listing(overrides) {
  return {
    provider: 'mock',
    address: {},
    lotSize: 0,
    yearBuilt: 2000,
    propertyType: 'SINGLE_FAMILY',
    photos: [],
    listingUrl: '',
    description: '',
    ...overrides,
  };
}

const L1 = listing({ providerId: 'L1', zip: '11373', price: 400000, bedrooms: 2, bathrooms: 1, sqft: 900, status: 'for_sale' });
const L2 = listing({ providerId: 'L2', zip: '11373', price: 500000, bedrooms: 3, bathrooms: 2, sqft: 1200, status: 'for_sale' });
const L3 = listing({ providerId: 'L3', zip: '11373', price: 700000, bedrooms: 4, bathrooms: 3, sqft: 1800, status: 'for_sale' });
const L4 = listing({ providerId: 'L4', zip: '11373', price: 550000, bedrooms: 1, bathrooms: 1, sqft: 650, status: 'pending' });
const L5 = listing({ providerId: 'L5', zip: '07069', price: 600000, bedrooms: 3, bathrooms: 2, sqft: 1500, status: 'for_sale' });
const L6 = listing({ providerId: 'L6', zip: '07069', price: 300000, bedrooms: 2, bathrooms: 1, sqft: 1000, status: 'for_sale' });
const L7 = listing({ providerId: 'L7', zip: '10001', price: 900000, bedrooms: 1, bathrooms: 1, sqft: 600, status: 'for_sale' });

const LISTINGS = [L1, L2, L3, L4, L5, L6, L7];
const ids = (results) => results.map((r) => r.providerId);

test('ZIP filter: only listings in prefs.zipCodes are returned', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('ZIP filter: excludes non-matching zips even when other filters would pass', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['07069'] }, {});
  assert.deepEqual(ids(results).sort(), ['L5', 'L6'].sort());
});

test('ZIP with no listings at all returns []', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['99999'] }, {});
  assert.deepEqual(results, []);
});

test('Status filter: excludes non-for_sale listings even when zip matches', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 1 }, { bedrooms: 'atLeast' });
  assert.ok(!ids(results).includes('L4'));
});

test("Bedrooms 'exact' mode returns only the exact match", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 3 }, { bedrooms: 'exact' });
  assert.deepEqual(ids(results), ['L2']);
});

test("Bedrooms 'atLeast' mode returns bedrooms >= pref", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 3 }, { bedrooms: 'atLeast' });
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test("Bedrooms 'atLeastMinusOne' mode returns bedrooms >= pref - 1", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 3 }, { bedrooms: 'atLeastMinusOne' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Bedrooms filter is skipped entirely when prefs.bedrooms is missing', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { bedrooms: 'exact' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Bedrooms filter is skipped when prefs.bedrooms is explicitly null', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: null }, { bedrooms: 'exact' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test("Bathrooms 'exact' mode returns only the exact match", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bathrooms: 2 }, { bathrooms: 'exact' });
  assert.deepEqual(ids(results), ['L2']);
});

test("Bathrooms 'atLeast' mode returns bathrooms >= pref", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bathrooms: 2 }, { bathrooms: 'atLeast' });
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test("Bathrooms 'atLeastMinusOne' mode returns bathrooms >= pref - 1", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bathrooms: 2 }, { bathrooms: 'atLeastMinusOne' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Bathrooms filter is skipped entirely when prefs.bathrooms is missing', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { bathrooms: 'exact' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Bathrooms filter is skipped when prefs.bathrooms is explicitly null', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bathrooms: null }, { bathrooms: 'exact' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test("Family size 'derivedBedrooms' requires beds >= ceil(familySize/2)", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], familySize: 5 }, { familySize: 'derivedBedrooms' });
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test("Family size 'derivedBedrooms' edge case: familySize=1 -> requires beds >= 1", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], familySize: 1 }, { familySize: 'derivedBedrooms' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test("Family size 'minSqft' requires sqft >= familySize * sqftPerPerson", () => {
  const results = matchListings(
    LISTINGS,
    { zipCodes: ['11373'], familySize: 3 },
    { familySize: 'minSqft', sqftPerPerson: 400 }
  );
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test("Family size 'minSqft' uses default sqftPerPerson (400) when not specified", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], familySize: 3 }, { familySize: 'minSqft' });
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test('Family size filter is skipped when rules.familySize is missing', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], familySize: 1 }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Family size filter is skipped when prefs.familySize is missing', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { familySize: 'derivedBedrooms' });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Basement: true matches only listings with a basement', () => {
  const B1 = listing({ providerId: 'B1', zip: '55501', price: 400000, status: 'for_sale', basement: true });
  const B2 = listing({ providerId: 'B2', zip: '55501', price: 400000, status: 'for_sale', basement: false });
  const B3 = listing({ providerId: 'B3', zip: '55501', price: 400000, status: 'for_sale' });
  const results = matchListings([B1, B2, B3], { zipCodes: ['55501'], basement: true }, {});
  assert.deepEqual(ids(results), ['B1']);
});

test('Basement: false matches only listings without a basement', () => {
  const B1 = listing({ providerId: 'B1', zip: '55501', price: 400000, status: 'for_sale', basement: true });
  const B2 = listing({ providerId: 'B2', zip: '55501', price: 400000, status: 'for_sale', basement: false });
  const results = matchListings([B1, B2], { zipCodes: ['55501'], basement: false }, {});
  assert.deepEqual(ids(results), ['B2']);
});

test('Basement filter is skipped when the buyer has no preference (matches listings with unknown data too)', () => {
  const B1 = listing({ providerId: 'B1', zip: '55501', price: 400000, status: 'for_sale', basement: true });
  const B2 = listing({ providerId: 'B2', zip: '55501', price: 400000, status: 'for_sale', basement: false });
  const B3 = listing({ providerId: 'B3', zip: '55501', price: 400000, status: 'for_sale' });
  const results = matchListings([B1, B2, B3], { zipCodes: ['55501'] }, {});
  assert.deepEqual(ids(results).sort(), ['B1', 'B2', 'B3']);
});

test('Home type: buyer list restricts to matching propertyType values', () => {
  const H1 = listing({ providerId: 'H1', zip: '55502', price: 400000, status: 'for_sale', propertyType: 'CONDO' });
  const H2 = listing({ providerId: 'H2', zip: '55502', price: 400000, status: 'for_sale', propertyType: 'SINGLE_FAMILY' });
  const H3 = listing({ providerId: 'H3', zip: '55502', price: 400000, status: 'for_sale', propertyType: 'TOWNHOUSE' });
  const results = matchListings([H1, H2, H3], { zipCodes: ['55502'], homeType: ['CONDO', 'TOWNHOUSE'] }, {});
  assert.deepEqual(ids(results).sort(), ['H1', 'H3']);
});

test('Home type filter is skipped when the buyer preference list is empty', () => {
  const H1 = listing({ providerId: 'H1', zip: '55502', price: 400000, status: 'for_sale', propertyType: 'CONDO' });
  const H2 = listing({ providerId: 'H2', zip: '55502', price: 400000, status: 'for_sale', propertyType: 'SINGLE_FAMILY' });
  const results = matchListings([H1, H2], { zipCodes: ['55502'], homeType: [] }, {});
  assert.deepEqual(ids(results).sort(), ['H1', 'H2']);
});

test('Parking: true matches only listings with parking', () => {
  const P1 = listing({ providerId: 'P1', zip: '55503', price: 400000, status: 'for_sale', parking: true });
  const P2 = listing({ providerId: 'P2', zip: '55503', price: 400000, status: 'for_sale', parking: false });
  const results = matchListings([P1, P2], { zipCodes: ['55503'], parking: true }, {});
  assert.deepEqual(ids(results), ['P1']);
});

test('Parking filter is skipped when the buyer has no preference', () => {
  const P1 = listing({ providerId: 'P1', zip: '55503', price: 400000, status: 'for_sale', parking: true });
  const P2 = listing({ providerId: 'P2', zip: '55503', price: 400000, status: 'for_sale', parking: false });
  const results = matchListings([P1, P2], { zipCodes: ['55503'] }, {});
  assert.deepEqual(ids(results).sort(), ['P1', 'P2']);
});

test('Minimum square footage excludes listings below the threshold', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], minSqft: 1000 }, {});
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test('Minimum square footage is skipped when unset', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Minimum year built excludes listings built earlier', () => {
  const Y1 = listing({ providerId: 'Y1', zip: '55504', price: 400000, status: 'for_sale', yearBuilt: 1980 });
  const Y2 = listing({ providerId: 'Y2', zip: '55504', price: 400000, status: 'for_sale', yearBuilt: 2005 });
  const Y3 = listing({ providerId: 'Y3', zip: '55504', price: 400000, status: 'for_sale', yearBuilt: 2015 });
  const results = matchListings([Y1, Y2, Y3], { zipCodes: ['55504'], minYearBuilt: 2000 }, {});
  assert.deepEqual(ids(results).sort(), ['Y2', 'Y3']);
});

test('Minimum year built is skipped when unset', () => {
  const Y1 = listing({ providerId: 'Y1', zip: '55504', price: 400000, status: 'for_sale', yearBuilt: 1980 });
  const Y2 = listing({ providerId: 'Y2', zip: '55504', price: 400000, status: 'for_sale', yearBuilt: 2005 });
  const results = matchListings([Y1, Y2], { zipCodes: ['55504'] }, {});
  assert.deepEqual(ids(results).sort(), ['Y1', 'Y2']);
});

test("Listing type 'rent' matches nothing (no rental inventory exists)", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], listingType: 'rent' }, {});
  assert.deepEqual(results, []);
});

test("Listing type 'buy' (or unset) applies no extra filtering beyond status", () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], listingType: 'buy' }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Max price filter excludes listings priced above the cap (inclusive boundary)', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { maxPrice: 500000 });
  assert.deepEqual(ids(results), ['L1', 'L2']);
});

test('Max price of null applies no price filtering', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { maxPrice: null });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Exclusions remove specific listings by providerId', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], excludeListingIds: ['L2'] }, {});
  assert.deepEqual(ids(results), ['L1', 'L3']);
});

test('Exclusions with an empty array has no effect', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], excludeListingIds: [] }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('Results are sorted by price ascending regardless of input order', () => {
  const shuffled = [L3, L1, L2];
  const results = matchListings(shuffled, { zipCodes: ['11373'] }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('maxListingsPerBuyer caps the result set', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { maxListingsPerBuyer: 2 });
  assert.deepEqual(ids(results), ['L1', 'L2']);
});

test('A cap larger than the result count returns everything, no padding or error', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { maxListingsPerBuyer: 10 });
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('A cap of 0 returns an empty array', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, { maxListingsPerBuyer: 0 });
  assert.deepEqual(results, []);
});

test('Empty listings input returns []', () => {
  const results = matchListings([], { zipCodes: ['11373'] }, {});
  assert.deepEqual(results, []);
});

test('A combination of filters that matches nothing returns []', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 10 }, { bedrooms: 'exact' });
  assert.deepEqual(results, []);
});

test('Completely empty prefs ({}) does not throw and returns no matches', () => {
  const results = matchListings(LISTINGS, {}, {});
  assert.deepEqual(results, []);
});

test('Completely empty rules ({}) falls back to atLeast bedroom matching', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 3 }, {});
  assert.deepEqual(ids(results), ['L2', 'L3']);
});

test('Combines ZIP + bedrooms + maxPrice across multiple ZIPs correctly', () => {
  const results = matchListings(
    LISTINGS,
    { zipCodes: ['11373', '07069'], bedrooms: 3 },
    { bedrooms: 'atLeast', maxPrice: 650000 }
  );
  assert.deepEqual(ids(results), ['L2', 'L5']);
});

test('A buyer with every filter unset matches everything in their ZIP (send-all behavior)', () => {
  const results = matchListings(LISTINGS, { zipCodes: ['11373'] }, {});
  assert.deepEqual(ids(results), ['L1', 'L2', 'L3']);
});

test('The input listings array is never mutated', () => {
  const original = [L3, L1, L2];
  const snapshotOrder = original.map((l) => l.providerId);
  matchListings(original, { zipCodes: ['11373'] }, { maxListingsPerBuyer: 1 });
  assert.deepEqual(
    original.map((l) => l.providerId),
    snapshotOrder
  );
});

test('Individual listing objects are never mutated', () => {
  const before = JSON.stringify(L2);
  matchListings(LISTINGS, { zipCodes: ['11373'], bedrooms: 3 }, { bedrooms: 'exact', maxPrice: 100 });
  assert.equal(JSON.stringify(L2), before);
});

test('Given the same inputs, always returns the same output (determinism)', () => {
  const prefs = { zipCodes: ['11373', '07069'], bedrooms: 2, familySize: 4 };
  const rules = { bedrooms: 'atLeast', familySize: 'derivedBedrooms', maxPrice: 800000, maxListingsPerBuyer: 5 };
  const first = matchListings(LISTINGS, prefs, rules);
  const second = matchListings(LISTINGS, prefs, rules);
  assert.deepEqual(first, second);
});

test('Listings with tied prices are handled without error or dropped results', () => {
  const tiedA = listing({ providerId: 'T1', zip: '55555', price: 400000, bedrooms: 2, sqft: 900, status: 'for_sale' });
  const tiedB = listing({ providerId: 'T2', zip: '55555', price: 400000, bedrooms: 3, sqft: 1000, status: 'for_sale' });
  const results = matchListings([tiedA, tiedB], { zipCodes: ['55555'] }, {});
  assert.deepEqual(ids(results).sort(), ['T1', 'T2']);
});
