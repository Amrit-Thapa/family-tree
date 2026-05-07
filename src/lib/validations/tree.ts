import { z } from 'zod';

/** Maximum length for a tree name. */
export const TREE_NAME_MAX = 100;

/** Maximum length for a tree description. */
export const TREE_DESCRIPTION_MAX = 500;

export const createTreeSchema = z.object({
  name: z
    .string()
    .min(1, 'Tree name is required')
    .max(TREE_NAME_MAX, `Tree name must be at most ${TREE_NAME_MAX} characters`)
    .transform((val) => val.trim())
    .pipe(z.string().min(1, 'Tree name cannot be empty after trimming')),
  description: z
    .string()
    .max(TREE_DESCRIPTION_MAX, `Description must be at most ${TREE_DESCRIPTION_MAX} characters`)
    .optional(),
});

export const updateTreeSchema = z.object({
  name: z
    .string()
    .min(1, 'Tree name is required')
    .max(TREE_NAME_MAX, `Tree name must be at most ${TREE_NAME_MAX} characters`)
    .transform((val) => val.trim())
    .pipe(z.string().min(1, 'Tree name cannot be empty after trimming'))
    .optional(),
  description: z
    .string()
    .max(TREE_DESCRIPTION_MAX, `Description must be at most ${TREE_DESCRIPTION_MAX} characters`)
    .optional(),
});

export type CreateTreeInput = z.infer<typeof createTreeSchema>;
export type UpdateTreeInput = z.infer<typeof updateTreeSchema>;
