import { z } from 'zod';
import {
  INVITE_LABEL_MAX,
  DEFAULT_MAX_USES,
  MAX_USES_LIMIT,
  INVITE_DEFAULT_EXPIRY_DAYS,
  INVITE_MAX_EXPIRY_DAYS,
} from '@/lib/constants/invite';

const membershipRoleSchema = z.enum(['admin', 'editor', 'viewer']);

/**
 * Schema for changing a member's role.
 * Used by PATCH /api/trees/[treeId]/members/[userId]
 */
export const changeMemberRoleSchema = z.object({
  role: membershipRoleSchema,
});

export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

/**
 * Schema for creating an invite link (request body only — treeId comes from URL params).
 * Used by POST /api/trees/[treeId]/invites
 */
export const createInviteBodySchema = z.object({
  role: membershipRoleSchema,
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

export type CreateInviteBodyInput = z.infer<typeof createInviteBodySchema>;
