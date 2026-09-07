import { query } from '../db/pool.js';
import { mapRow, mapRows, toJsonbParam } from './shared.js';

const UPSERT_SQL = `
  insert into listings (
    provider, provider_id, zip, address, price, bedrooms, bathrooms, sqft, lot_size,
    year_built, property_type, basement, parking, status, photos, listing_url, description, raw
  ) values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
  on conflict (provider, provider_id) do update set
    zip = excluded.zip,
    address = excluded.address,
    price = excluded.price,
    bedrooms = excluded.bedrooms,
    bathrooms = excluded.bathrooms,
    sqft = excluded.sqft,
    lot_size = excluded.lot_size,
    year_built = excluded.year_built,
    property_type = excluded.property_type,
    basement = excluded.basement,
    parking = excluded.parking,
    status = excluded.status,
    photos = excluded.photos,
    listing_url = excluded.listing_url,
    description = excluded.description,
    raw = excluded.raw,
    fetched_at = now(),
    updated_at = now()
`;

// Dev-scale data volumes - a loop of single-row upserts is simplest and
// matches "don't design for scale that doesn't exist yet".
export async function bulkUpsert(listings) {
  // eslint-disable-next-line no-restricted-syntax
  for (const listing of listings) {
    // eslint-disable-next-line no-await-in-loop
    await query(UPSERT_SQL, [
      listing.provider,
      listing.providerId,
      listing.zip,
      toJsonbParam(listing.address || {}),
      listing.price ?? null,
      listing.bedrooms ?? null,
      listing.bathrooms ?? null,
      listing.sqft ?? null,
      listing.lotSize ?? null,
      listing.yearBuilt ?? null,
      listing.propertyType ?? null,
      listing.basement ?? null,
      listing.parking ?? null,
      listing.status || 'for_sale',
      listing.photos || [],
      listing.listingUrl ?? null,
      listing.description ?? null,
      toJsonbParam(listing.raw ?? null),
    ]);
  }
}

export async function findIdMapByProviderIds(provider, providerIds) {
  if (providerIds.length === 0) return new Map();
  const { rows } = await query('select id, provider_id from listings where provider = $1 and provider_id = any($2::text[])', [
    provider,
    providerIds,
  ]);
  return new Map(rows.map((row) => [row.provider_id, row.id]));
}

export async function findByIds(ids) {
  if (ids.length === 0) return [];
  const { rows } = await query('select * from listings where id = any($1::uuid[])', [ids]);
  return mapRows(rows);
}
