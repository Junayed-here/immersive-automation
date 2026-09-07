import { z } from 'zod';

export const previewSpreadsheetSchema = z.object({
  url: z.string().trim().min(1, 'A spreadsheet URL is required.'),
});

const columnMappingSchema = z
  .object({
    name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    zip: z.string().trim().optional(),
    familySize: z.string().trim().optional(),
    bedrooms: z.string().trim().optional(),
  })
  .partial();

export const connectSpreadsheetSchema = z.object({
  url: z.string().trim().min(1, 'A spreadsheet URL is required.'),
  columnMapping: columnMappingSchema.optional(),
});
