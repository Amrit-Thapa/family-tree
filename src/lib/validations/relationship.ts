import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Invalid ObjectId format');

export const relationshipTypeSchema = z.enum([
  'parent_child',
  'spouse',
  'sibling',
]);

export const relationshipDirectionSchema = z.enum(['forward', 'inverse']);

export const createRelationshipSchema = z.object({
  treeId: objectIdSchema,
  fromPersonId: objectIdSchema,
  toPersonId: objectIdSchema,
  type: relationshipTypeSchema,
  direction: relationshipDirectionSchema,
  label: z
    .string()
    .max(50, 'Label must be at most 50 characters')
    .optional(),
});

export const updateRelationshipSchema = z.object({
  label: z
    .string()
    .max(50, 'Label must be at most 50 characters')
    .optional(),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;
