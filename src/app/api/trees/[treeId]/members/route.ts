import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/require-session';
import {
  getMembers,
  changeMemberRole,
  removeMember,
} from '@/lib/services/membership.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';
import { changeMemberRoleSchema } from '@/lib/validations/membership';

// --- Request body schemas ---

const changeRoleBodySchema = changeMemberRoleSchema.extend({
  targetUserId: z.string().min(1, 'targetUserId is required'),
});

const removeMemberBodySchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
});

/**
 * GET /api/trees/[treeId]/members
 *
 * Lists all active members of a family tree.
 * Requires the authenticated user to have an active membership on the tree.
 * Returns 404 (not 403) when user doesn't have access to avoid leaking tree existence.
 *
 * Success response: 200 { members: MemberResult[] }
 * Error responses: 401 (not authenticated), 404 (not found or no access), 500 (unexpected)
 */
export const GET = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    await verifyTreeMembership(session.userId, treeId);

    const members = await getMembers(treeId);

    return Response.json({ members }, { status: 200 });
  }
);

/**
 * PATCH /api/trees/[treeId]/members
 *
 * Changes a member's role within a family tree.
 * Requires the authenticated user to have admin role on the tree.
 * Enforces last-admin protection (cannot demote the last admin).
 *
 * Request body: { targetUserId: string, role: 'admin' | 'editor' | 'viewer' }
 * Success response: 200 { member: MemberResult }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin / last admin),
 *                  404 (not found or no access), 500 (unexpected)
 */
export const PATCH = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    await verifyTreeMembership(session.userId, treeId, 'admin');

    const { role, targetUserId } = await validateBody(request, changeRoleBodySchema);

    const member = await changeMemberRole(treeId, targetUserId, role, session.userId);

    return Response.json({ member }, { status: 200 });
  }
);

/**
 * DELETE /api/trees/[treeId]/members
 *
 * Removes a member from a family tree (soft delete).
 * Requires the authenticated user to have admin role on the tree.
 * Enforces last-admin protection (cannot remove the last admin).
 * Prevents self-removal — admins should use a dedicated "leave tree" flow.
 *
 * Request body: { targetUserId: string }
 * Success response: 200 { member: MemberResult }
 * Error responses: 400 (validation / self-removal), 401 (not authenticated),
 *                  403 (not admin / last admin), 404 (not found or no access), 500 (unexpected)
 */
export const DELETE = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    await verifyTreeMembership(session.userId, treeId, 'admin');

    const { targetUserId } = await validateBody(request, removeMemberBodySchema);

    const member = await removeMember(treeId, targetUserId, session.userId);

    return Response.json({ member }, { status: 200 });
  }
);
