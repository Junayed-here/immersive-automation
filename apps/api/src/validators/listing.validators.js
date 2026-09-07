import { z } from 'zod';
import { normalizeZip, isValidZip } from '../utils/zip.js';

export const listListingsQuerySchema = z.object({
  zip: z
    .union([z.string(), z.number()])
    .transform((v) => normalizeZip(v))
    .refine(isValidZip, 'zip must normalize to exactly 5 digits.'),
  beds: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
});
