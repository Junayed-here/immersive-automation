import * as spreadsheetConnectionsRepo from '../repositories/spreadsheetConnections.repo.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';
import { parseSheetUrl } from '../services/spreadsheet/urlParser.js';
import { previewSpreadsheet, syncSpreadsheet } from '../services/spreadsheet/sync.service.js';

export const listConnections = asyncHandler(async function listConnections(req, res) {
  const connections = await spreadsheetConnectionsRepo.list(req.realtorId);
  return ok(res, 200, { connections });
});

export const preview = asyncHandler(async function preview(req, res) {
  const { fileId, gid, exportUrl } = parseSheetUrl(req.body.url);
  const result = await previewSpreadsheet({ fileId, gid, exportUrl });
  return ok(res, 200, result);
});

export const connect = asyncHandler(async function connect(req, res) {
  const { fileId, gid, exportUrl } = parseSheetUrl(req.body.url);

  const connection = await spreadsheetConnectionsRepo.create({
    realtorId: req.realtorId,
    sheetUrl: req.body.url,
    fileId,
    gid,
    exportUrl,
    columnMapping: req.body.columnMapping,
  });

  return ok(res, 201, { connection }, 'Spreadsheet connected.');
});

export const sync = asyncHandler(async function sync(req, res) {
  const connection = await spreadsheetConnectionsRepo.findById(req.realtorId, req.params.id);
  if (!connection) {
    return fail(res, 404, 'Spreadsheet connection not found.');
  }

  const stats = await syncSpreadsheet(connection);
  return ok(res, 200, { stats }, 'Sync complete.');
});
