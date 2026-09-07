import { query } from '../db/pool.js';
import { mapRow, mapRows, toJsonbParam } from './shared.js';

export async function list(realtorId) {
  const { rows } = await query(
    'select * from spreadsheet_connections where realtor_id = $1 order by created_at desc',
    [realtorId]
  );
  return mapRows(rows);
}

export async function create({ realtorId, sheetUrl, fileId, gid, exportUrl, columnMapping }) {
  const { rows } = await query(
    `insert into spreadsheet_connections (realtor_id, sheet_url, file_id, gid, export_url, column_mapping)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [realtorId, sheetUrl, fileId, gid, exportUrl, toJsonbParam(columnMapping || {})]
  );
  return mapRow(rows[0]);
}

export async function findById(realtorId, id) {
  const { rows } = await query('select * from spreadsheet_connections where id = $1 and realtor_id = $2', [
    id,
    realtorId,
  ]);
  return mapRow(rows[0]);
}

export async function recordSyncResult(id, { lastSyncedAt, lastSyncStatus, lastSyncStats }) {
  const { rows } = await query(
    `update spreadsheet_connections
     set last_synced_at = $2, last_sync_status = $3, last_sync_stats = $4, updated_at = now()
     where id = $1
     returning *`,
    [id, lastSyncedAt, lastSyncStatus, toJsonbParam(lastSyncStats)]
  );
  return mapRow(rows[0]);
}

// Cross-tenant, admin-only "needs attention" widget - mirrors
// adminOverview.controller.js's one intentionally unscoped read.
export async function listErrored() {
  const { rows } = await query(
    `select sc.*, r.first_name as realtor_first_name, r.last_name as realtor_last_name
     from spreadsheet_connections sc
     join realtors r on r.id = sc.realtor_id
     where sc.last_sync_status = 'error'`
  );
  return rows.map((row) => {
    const mapped = mapRow(row);
    return {
      _id: mapped._id,
      sheetUrl: mapped.sheetUrl,
      realtorId: { _id: mapped.realtorId, firstName: row.realtor_first_name, lastName: row.realtor_last_name },
    };
  });
}
