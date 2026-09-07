import crypto from 'node:crypto';
import * as buyersRepo from '../../repositories/buyers.repo.js';
import * as spreadsheetConnectionsRepo from '../../repositories/spreadsheetConnections.repo.js';
import { getSheetFetcher } from './fetcher.js';
import { parseBuyersCsv } from './parser.js';
import { isPrivateSheetResponse } from './guards.js';
import { SpreadsheetSyncError } from './errors.js';

const NOT_PUBLIC_MESSAGE = 'This spreadsheet is not publicly viewable. Share it with "Anyone with the link" and try again.';

export async function previewSpreadsheet({ fileId, gid, exportUrl }) {
  const fetcher = getSheetFetcher();
  const { contentType, body } = await fetcher.fetchCsv({ fileId, gid, exportUrl });

  if (isPrivateSheetResponse(contentType, body)) {
    throw new SpreadsheetSyncError(NOT_PUBLIC_MESSAGE, 'NOT_PUBLIC', 422);
  }

  const { headers, rows } = parseBuyersCsv(body);
  return { headers, sampleRows: rows.slice(0, 5) };
}

function buildPreferencesPatch(row) {
  return {
    zipCodes: row.zipCodes,
    ...(row.familySize !== undefined ? { familySize: row.familySize } : {}),
    ...(row.bedrooms !== undefined ? { bedrooms: row.bedrooms } : {}),
    ...(row.bathrooms !== undefined ? { bathrooms: row.bathrooms } : {}),
    ...(row.basement !== undefined ? { basement: row.basement } : {}),
    ...(row.homeType.length > 0 ? { homeType: row.homeType } : {}),
    ...(row.parking !== undefined ? { parking: row.parking } : {}),
    ...(row.minSqft !== undefined ? { minSqft: row.minSqft } : {}),
    ...(row.minYearBuilt !== undefined ? { minYearBuilt: row.minYearBuilt } : {}),
    listingType: row.listingType,
  };
}

export async function syncSpreadsheet(connection) {
  const fetcher = getSheetFetcher();
  const { contentType, body } = await fetcher.fetchCsv({
    fileId: connection.fileId,
    gid: connection.gid,
    exportUrl: connection.exportUrl,
  });

  if (isPrivateSheetResponse(contentType, body)) {
    await spreadsheetConnectionsRepo.recordSyncResult(connection._id, {
      lastSyncedAt: new Date(),
      lastSyncStatus: 'error',
      lastSyncStats: {
        rowsRead: 0,
        created: 0,
        updated: 0,
        archived: 0,
        duplicates: 0,
        errors: [{ message: NOT_PUBLIC_MESSAGE }],
      },
    });
    throw new SpreadsheetSyncError(NOT_PUBLIC_MESSAGE, 'NOT_PUBLIC', 422);
  }

  const { rows, errors, duplicates } = parseBuyersCsv(body);
  const seenEmails = rows.map((row) => row.email);

  let created = 0;
  let updated = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const inserted = await buyersRepo.upsertFromSpreadsheetRow({
      realtorId: connection.realtorId,
      spreadsheetConnectionId: connection._id,
      row,
      preferencesPatch: buildPreferencesPatch(row),
      sourceRowHash: hashRow(row),
    });
    if (inserted) created += 1;
    else updated += 1;
  }

  const archived = await buyersRepo.archiveMissingFromSync(connection.realtorId, connection._id, seenEmails);

  const stats = {
    rowsRead: rows.length + errors.length,
    created,
    updated,
    archived,
    duplicates,
    errors,
  };

  await spreadsheetConnectionsRepo.recordSyncResult(connection._id, {
    lastSyncedAt: new Date(),
    lastSyncStatus: errors.length > 0 ? 'partial' : 'ok',
    lastSyncStats: stats,
  });

  return stats;
}

function hashRow(row) {
  return crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex');
}
