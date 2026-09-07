import { z } from 'zod';
import cron from 'node-cron';

const audienceSchema = z.object({
  type: z.enum(['all', 'zipList', 'buyerIds']),
  value: z.array(z.string()).optional(),
});

const familySizeRuleSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(['derivedBedrooms', 'minSqft']).optional(),
    sqftPerPerson: z.number().positive().optional(),
  })
  .partial();

const matchRulesSchema = z
  .object({
    bedrooms: z.enum(['exact', 'atLeast', 'atLeastMinusOne']).optional(),
    bathrooms: z.enum(['exact', 'atLeast', 'atLeastMinusOne']).optional(),
    familySize: familySizeRuleSchema.optional(),
    maxPrice: z.number().positive().nullable().optional(),
    maxListingsPerBuyer: z.number().int().positive().optional(),
    excludePreviouslySent: z.boolean().optional(),
  })
  .partial();

const emailTemplateSchema = z
  .object({
    subject: z.string().optional(),
    introHtml: z.string().optional(),
    ctaLabel: z.string().optional(),
    theme: z.object({ accentColor: z.string().optional() }).partial().optional(),
  })
  .partial();

const scheduleSchema = z
  .object({
    mode: z.enum(['manual', 'cron']).optional(),
    cron: z
      .string()
      .nullable()
      .optional()
      .refine((value) => !value || cron.validate(value), 'Not a valid cron expression.'),
    timezone: z.string().nullable().optional(),
  })
  .partial()
  .refine(
    (value) => value.mode !== 'cron' || !!value.cron,
    { message: 'A cron expression is required when schedule.mode is "cron".', path: ['cron'] }
  );

export const createAutomationSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  spreadsheetConnectionId: z.string().optional().nullable(),
  audience: audienceSchema,
  matchRules: matchRulesSchema.optional(),
  emailTemplate: emailTemplateSchema.optional(),
  schedule: scheduleSchema.optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
});

export const updateAutomationSchema = createAutomationSchema.partial();

export const listAutomationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
