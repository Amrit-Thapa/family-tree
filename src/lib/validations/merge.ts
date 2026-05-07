import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Invalid ObjectId format');

export const fieldResolutionSchema = z.record(
  z.string(),
  z.enum(['source', 'target'])
);

export const createMergeRequestSchema = z.object({
  treeId: objectIdSchema,
  sourcePersonId: objectIdSchema,
  targetPersonId: objectIdSchema,
  fieldResolutions: fieldResolutionSchema.optional(),
});

export type CreateMergeRequestInput = z.infer<typeof createMergeRequestSchema>;
