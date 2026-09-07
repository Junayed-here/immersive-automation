import { Router } from 'express';
import { listConnections, preview, connect, sync } from '../controllers/spreadsheets.controller.js';
import { validate } from '../middleware/validate.js';
import { previewSpreadsheetSchema, connectSpreadsheetSchema } from '../validators/spreadsheet.validators.js';

export const spreadsheetsRouter = Router();

spreadsheetsRouter.get('/', listConnections);
spreadsheetsRouter.post('/preview', validate(previewSpreadsheetSchema), preview);
spreadsheetsRouter.post('/connect', validate(connectSpreadsheetSchema), connect);
spreadsheetsRouter.post('/:id/sync', sync);
