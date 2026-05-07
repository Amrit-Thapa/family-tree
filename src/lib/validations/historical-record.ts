import { z } from 'zod';
import { objectIdSchema } from './common';

export const historicalRecordTypeSchema = z.enum([
  'life_event',
  'story',
  'migration',
  'document',
  'note',
  'custom',
]);

export const createHistoricalRecordSchema = z.object({
  personId: objectIdSchema,
  treeId: objectIdSchema,
  type: historicalRecordTypeSchema,
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional(),
  date: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  mediaAssetIds: z.array(objectIdSchema).optional(),
});

export const updateHistoricalRecordSchema = z.object({
  type: historicalRecordTypeSchema.optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters')
    .optional(),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters')
    .optional(),
  date: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  mediaAssetIds: z.array(objectIdSchema).optional(),
});

export type CreateHistoricalRecordInput = z.infer<
  typeof createHistoricalRecordSchema
>;
export type UpdateHistoricalRecordInput = z.infer<
  typeof updateHistoricalRecordSchema
>;
