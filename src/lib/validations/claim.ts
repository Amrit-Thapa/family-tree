import { z } from 'zod';
import { objectIdSchema } from './common';

export { objectIdSchema };

export const createClaimSchema = z.object({
  treeId: objectIdSchema,
  personId: objectIdSchema,
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
