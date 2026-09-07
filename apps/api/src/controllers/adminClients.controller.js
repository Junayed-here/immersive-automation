import * as realtorsRepo from '../repositories/realtors.repo.js';
import * as spreadsheetConnectionsRepo from '../repositories/spreadsheetConnections.repo.js';
import { parseSheetUrl } from '../services/spreadsheet/urlParser.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ok, fail } from '../utils/respond.js';

export const listRealtors = asyncHandler(async function listRealtors(req, res) {
  const { search, status, page = 1, limit = 20 } = req.query;

  const { realtors, total } = await realtorsRepo.list({ search, status, page, limit });

  return ok(res, 200, { realtors, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
});

export const createRealtor = asyncHandler(async function createRealtor(req, res) {
  const { sheetUrl, ...realtorFields } = req.body;

  const realtor = await realtorsRepo.create(realtorFields);

  let connection = null;
  if (sheetUrl) {
    const { fileId, gid, exportUrl } = parseSheetUrl(sheetUrl);
    connection = await spreadsheetConnectionsRepo.create({
      realtorId: realtor._id,
      sheetUrl,
      fileId,
      gid,
      exportUrl,
    });
  }

  return ok(res, 201, { realtor, connection }, 'Client onboarded.');
});

export const getRealtor = asyncHandler(async function getRealtor(req, res) {
  const realtor = await realtorsRepo.findById(req.params.realtorId);
  if (!realtor) return fail(res, 404, 'Client not found.');
  return ok(res, 200, { realtor });
});

export const updateRealtor = asyncHandler(async function updateRealtor(req, res) {
  const realtor = await realtorsRepo.update(req.params.realtorId, req.body);
  if (!realtor) return fail(res, 404, 'Client not found.');
  return ok(res, 200, { realtor }, 'Client updated.');
});
