import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MockListingProvider } from '../src/services/listings/mock.provider.js';
import { ZillowProvider } from '../src/services/listings/zillow.provider.js';

const REQUIRED_FIELDS = [
  'provider',
  'providerId',
  'zip',
  'address',
  'price',
  'bedrooms',
  'bathrooms',
  'sqft',
  'status',
];

test('MockListingProvider.fetchByZip returns NormalizedListing-shaped, for_sale-only results', async () => {
  const provider = new MockListingProvider();
  const results = await provider.fetchByZip('11373');

  assert.ok(Array.isArray(results));
  assert.ok(results.length > 0);
  results.forEach((listing) => {
    REQUIRED_FIELDS.forEach((field) => assert.ok(field in listing, `missing field "${field}"`));
    assert.equal(listing.zip, '11373');
    assert.equal(listing.status, 'for_sale');
  });
});

test('MockListingProvider.fetchByZip returns [] for a ZIP with no for_sale listings', async () => {
  const provider = new MockListingProvider();
  const results = await provider.fetchByZip('11201');
  assert.deepEqual(results, []);
});

test('MockListingProvider.fetchById finds an existing listing and returns null for a missing one', async () => {
  const provider = new MockListingProvider();
  const [first] = await provider.fetchByZip('11373');
  const found = await provider.fetchById(first.providerId);
  assert.equal(found.providerId, first.providerId);

  const notFound = await provider.fetchById('does-not-exist');
  assert.equal(notFound, null);
});

test('ZillowProvider satisfies the same method contract as a stub', async () => {
  const provider = new ZillowProvider('fake-key');
  assert.equal(typeof provider.fetchByZip, 'function');
  assert.equal(typeof provider.fetchById, 'function');
  await assert.rejects(() => provider.fetchByZip('11373'), /NotImplemented/);
  await assert.rejects(() => provider.fetchById('123'), /NotImplemented/);
});
