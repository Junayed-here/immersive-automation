import { z } from 'zod';

const licenseSchema = z
  .object({
    number: z.string().trim().optional(),
    state: z.string().trim().optional(),
  })
  .partial();

const brokerageSchema = z
  .object({
    name: z.string().trim().optional(),
    address: z.string().trim().optional(),
    phone: z.string().trim().optional(),
  })
  .partial();

const profileSchema = z
  .object({
    photoUrl: z.string().trim().optional(),
    title: z.string().trim().optional(),
    bio: z.string().trim().optional(),
    signatureHtml: z.string().optional(),
  })
  .partial();

const emailSettingsSchema = z
  .object({
    fromName: z.string().trim().optional(),
    replyTo: z.string().trim().optional(),
    dailySendCap: z.number().int().positive().optional(),
  })
  .partial();

const notificationsSchema = z
  .object({
    enabled: z.boolean().optional(),
  })
  .partial();

export const createRealtorSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address.'),
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  phone: z.string().trim().optional(),
  license: licenseSchema.optional(),
  brokerage: brokerageSchema.optional(),
  // Optional - if given, a SpreadsheetConnection is created (not synced yet)
  // in the same request, per "provide their info including the sheet link".
  sheetUrl: z.string().trim().optional(),
});

export const updateRealtorSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional(),
    license: licenseSchema.optional(),
    brokerage: brokerageSchema.optional(),
    profile: profileSchema.optional(),
    emailSettings: emailSettingsSchema.optional(),
    usageLimit: z.number().positive().nullable().optional(),
    notifications: notificationsSchema.optional(),
    status: z.enum(['pending', 'active', 'suspended']).optional(),
  })
  .strict();

export const listRealtorsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(['pending', 'active', 'suspended', 'all']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
