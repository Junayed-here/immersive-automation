import { z } from 'zod';

export const sendTestEmailSchema = z.object({
  to: z.string().trim().toLowerCase().email('Must be a valid email address.'),
});
