import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Invalid ObjectId format');

export const relationshipTypeSchema = z.enum([
  'father',
  'mother',
  'spouse',
]);

export const spouseStatusSchema = z.enum(['active', 'divorced', 'separated']);

export const createRelationshipSchema = z.object({
  treeId: objectIdSchema,
  fromPersonId: objectIdSchema,
  toPersonId: objectIdSchema,
  type: relationshipTypeSchema,
  spouseStatus: spouseStatusSchema.optional(),
});

export const updateRelationshipSchema = z.object({
  spouseStatus: spouseStatusSchema.optional(),
});

export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
export type UpdateRelationshipInput = z.infer<typeof updateRelationshipSchema>;
