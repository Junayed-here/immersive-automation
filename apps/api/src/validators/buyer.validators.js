import { z } from 'zod';
import { normalizeZip, isValidZip } from '../utils/zip.js';
import { HOME_TYPES } from '../services/matching/homeTypes.js';

const zipSchema = z
  .union([z.string(), z.number()])
  .transform((v) => normalizeZip(v))
  .refine(isValidZip, 'ZIP must normalize to exactly 5 digits.');

const preferencesSchema = z
  .object({
    zipCodes: z.array(zipSchema).min(1, 'At least one ZIP is required.').optional(),
    familySize: z.number().int().positive().optional(),
    bedrooms: z.number().int().nonnegative().optional(),
    bathrooms: z.number().nonnegative().optional(),
    basement: z.boolean().optional(),
    homeType: z.array(z.enum(HOME_TYPES)).optional(),
    parking: z.boolean().optional(),
    minSqft: z.number().int().nonnegative().optional(),
    minYearBuilt: z.number().int().positive().optional(),
    listingType: z.enum(['buy', 'rent']).optional(),
  })
  .partial();

const communicationPrefsSchema = z
  .object({
    smsOptIn: z.boolean().optional(),
    whatsappOptIn: z.boolean().optional(),
  })
  .partial();

export const createBuyerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().toLowerCase().email('Must be a valid email address.'),
  phone: z.string().trim().min(1, 'Phone is required.'),
  preferences: preferencesSchema.optional(),
  communicationPrefs: communicationPrefsSchema.optional(),
  subscribed: z.boolean().optional(),
});

export const updateBuyerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().min(1).optional(),
    preferences: preferencesSchema.optional(),
    communicationPrefs: communicationPrefsSchema.optional(),
    subscribed: z.boolean().optional(),
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();

export const listBuyersQuerySchema = z.object({
  search: z.string().trim().optional(),
  zip: zipSchema.optional(),
  status: z.enum(['active', 'archived', 'all']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
