import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});
