import { z } from 'zod';
import { objectIdSchema } from './common';
import {
  INVITE_LABEL_MAX,
  DEFAULT_MAX_USES,
  MAX_USES_LIMIT,
  INVITE_DEFAULT_EXPIRY_DAYS,
  INVITE_MAX_EXPIRY_DAYS,
} from '@/lib/constants/invite';

export const inviteRoleSchema = z.enum(['admin', 'editor', 'viewer']);

export const createInviteSchema = z.object({
  role: inviteRoleSchema,
  treeId: objectIdSchema,
  label: z
    .string()
    .max(INVITE_LABEL_MAX, `Label must be ${INVITE_LABEL_MAX} characters or less`)
    .optional(),
  maxUses: z
    .number()
    .int('Max uses must be a whole number')
    .min(1, 'Max uses must be at least 1')
    .max(MAX_USES_LIMIT, `Max uses cannot exceed ${MAX_USES_LIMIT}`)
    .optional()
    .default(DEFAULT_MAX_USES),
  expiresInDays: z
    .number()
    .int()
    .min(1, 'Expiry must be at least 1 day')
    .max(INVITE_MAX_EXPIRY_DAYS, `Expiry cannot exceed ${INVITE_MAX_EXPIRY_DAYS} days`)
    .optional()
    .default(INVITE_DEFAULT_EXPIRY_DAYS),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
