import { z } from 'zod';

export const fieldVisibilityLevelSchema = z.enum([
  'all_members',
  'admins_only',
  'owner_and_admins',
]);

export const genderSchema = z.enum([
  'male',
  'female',
  'other',
  'prefer_not_to_say',
]);

export const locationSchema = z.object({
  city: z.string().max(100, 'City must be at most 100 characters').optional(),
  country: z
    .string()
    .max(100, 'Country must be at most 100 characters')
    .optional(),
});

export const fieldVisibilitySchema = z.object({
  dateOfBirth: fieldVisibilityLevelSchema.optional(),
  phoneNumber: fieldVisibilityLevelSchema.optional(),
  email: fieldVisibilityLevelSchema.optional(),
  biography: fieldVisibilityLevelSchema.optional(),
});

export const createPersonSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be at most 100 characters'),
  lastName: z
    .string()
    .max(100, 'Last name must be at most 100 characters')
    .optional(),
  maidenName: z
    .string()
    .max(100, 'Maiden name must be at most 100 characters')
    .optional(),
  dateOfBirth: z.coerce.date().optional(),
  dateOfDeath: z.coerce.date().optional(),
  gender: genderSchema.optional(),
  profession: z
    .string()
    .max(200, 'Profession must be at most 200 characters')
    .optional(),
  location: locationSchema.optional(),
  phoneNumber: z
    .string()
    .max(30, 'Phone number must be at most 30 characters')
    .optional(),
  email: z
    .string()
    .email('Invalid email address')
    .max(200, 'Email must be at most 200 characters')
    .optional(),
  biography: z
    .string()
    .max(2000, 'Biography must be at most 2000 characters')
    .optional(),
  fieldVisibility: fieldVisibilitySchema.optional(),
});

export const updatePersonSchema = createPersonSchema.partial();

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type FieldVisibilityLevel = z.infer<typeof fieldVisibilityLevelSchema>;
