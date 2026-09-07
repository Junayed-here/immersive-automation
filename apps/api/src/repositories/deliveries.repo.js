import { query, getClient } from '../db/pool.js';
import { mapRow, mapRows, toJsonbParam } from './shared.js';
import * as listingsRepo from './listings.repo.js';

async function attachListingIds(client, deliveryId, listingIds) {
  if (!listingIds || listingIds.length === 0) return;
  const values = listingIds.map((_, i) => `($1, $${i + 2})`).join(', ');
  await client.query(`insert into delivery_listings (delivery_id, listing_id) values ${values}`, [
    deliveryId,
    ...listingIds,
  ]);
}

export async function create({ runId, automationId, realtorId, buyerId, status, skipReason, listingIds, error }) {
  const client = await getClient();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into deliveries (run_id, automation_id, realtor_id, buyer_id, status, skip_reason, error)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       returning *`,
      [runId, automationId, realtorId, buyerId, status, skipReason ?? null, toJsonbParam(error || { message: null })]
    );
    const delivery = rows[0];
    await attachListingIds(client, delivery.id, listingIds);
    await client.query('commit');
    return { ...mapRow(delivery), listingIds: listingIds || [] };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function update(id, patch) {
  const columns = {
    status: 'status',
    skipReason: 'skip_reason',
    subject: 'subject',
    renderedHtml: 'rendered_html',
    providerMessageId: 'provider_message_id',
    sentAt: 'sent_at',
    error: 'error',
  };
  const jsonbFields = new Set(['error']);

  const sets = [];
  const params = [];
  Object.entries(patch).forEach(([key, value]) => {
    const column = columns[key];
    if (!column) return;
    params.push(jsonbFields.has(key) ? toJsonbParam(value) : value);
    sets.push(`${column} = $${params.length}`);
  });
  if (sets.length === 0) return null;

  params.push(id);
  const { rows } = await query(
    `update deliveries set ${sets.join(', ')}, updated_at = now() where id = $${params.length} returning *`,
    params
  );
  return mapRow(rows[0]);
}

async function withListingIds(deliveries) {
  if (deliveries.length === 0) return [];
  const { rows } = await query(
    'select delivery_id, listing_id from delivery_listings where delivery_id = any($1::uuid[])',
    [deliveries.map((d) => d.id)]
  );
  const byDelivery = new Map();
  rows.forEach((row) => {
    const list = byDelivery.get(row.delivery_id) || [];
    list.push(row.listing_id);
    byDelivery.set(row.delivery_id, list);
  });
  return deliveries.map((d) => ({ ...mapRow(d), listingIds: byDelivery.get(d.id) || [] }));
}

export async function findById(realtorId, id) {
  const { rows } = await query('select * from deliveries where id = $1 and realtor_id = $2', [id, realtorId]);
  const [withIds] = await withListingIds(rows);
  return withIds || null;
}

export async function findByIdWithBuyer(realtorId, id) {
  const { rows } = await query(
    `select d.*, b.name as buyer_name, b.email as buyer_email
     from deliveries d join buyers b on b.id = d.buyer_id
     where d.id = $1 and d.realtor_id = $2`,
    [id, realtorId]
  );
  if (rows.length === 0) return null;
  const [withIds] = await withListingIds(rows);
  return { ...withIds, buyerId: { _id: rows[0].buyer_id, name: rows[0].buyer_name, email: rows[0].buyer_email } };
}

export async function findByRunId(runId) {
  const { rows } = await query(
    `select d.*, b.name as buyer_name, b.email as buyer_email
     from deliveries d join buyers b on b.id = d.buyer_id
     where d.run_id = $1`,
    [runId]
  );
  const withIds = await withListingIds(rows);
  return withIds.map((d, i) => ({ ...d, buyerId: { _id: rows[i].buyer_id, name: rows[i].buyer_name, email: rows[i].buyer_email } }));
}

// Populates each delivery's listingIds with full listing rows (address,
// price, bedrooms, bathrooms, photos, listingUrl) - the join-table
// equivalent of Mongoose's .populate('listingIds', '...').
export async function findByBuyerId(realtorId, buyerId) {
  const { rows } = await query(
    'select * from deliveries where buyer_id = $1 and realtor_id = $2 order by created_at desc',
    [buyerId, realtorId]
  );
  const withIds = await withListingIds(rows);
  const allListingIds = [...new Set(withIds.flatMap((d) => d.listingIds))];
  const listings = await listingsRepo.findByIds(allListingIds);
  const listingsById = new Map(listings.map((l) => [l._id, l]));
  return withIds.map((d) => ({ ...d, listingIds: d.listingIds.map((id) => listingsById.get(id)).filter(Boolean) }));
}

export async function countSentListingsByBuyer(realtorId, buyerIds) {
  if (buyerIds.length === 0) return new Map();
  const { rows } = await query(
    `select d.buyer_id, count(dl.listing_id)::int as listing_count
     from deliveries d
     left join delivery_listings dl on dl.delivery_id = d.id
     where d.realtor_id = $1 and d.buyer_id = any($2::uuid[]) and d.status = 'sent'
     group by d.buyer_id`,
    [realtorId, buyerIds]
  );
  return new Map(rows.map((row) => [row.buyer_id, row.listing_count]));
}

export async function findPreviouslySentProviderIds(automationId, buyerId) {
  const { rows } = await query(
    `select distinct l.provider_id
     from deliveries d
     join delivery_listings dl on dl.delivery_id = d.id
     join listings l on l.id = dl.listing_id
     where d.automation_id = $1 and d.buyer_id = $2 and d.status = 'sent'`,
    [automationId, buyerId]
  );
  return rows.map((row) => row.provider_id);
}
