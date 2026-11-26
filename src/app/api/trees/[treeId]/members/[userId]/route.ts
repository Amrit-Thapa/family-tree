import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { connectDB } from '@/lib/db/connection';
import Membership from '@/lib/db/models/Membership';
import {
  changeMemberRole,
  removeMember,
} from '@/lib/services/membership.service';
import { NotFoundError } from '@/lib/utils/errors';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { changeMemberRoleSchema } from '@/lib/validations/membership';
import { Types } from 'mongoose';

/**
 * PATCH /api/trees/[treeId]/members/[userId]
 *
 * Changes a member's role within a family tree.
 * Requires the authenticated user to have admin role on the tree.
 * Enforces last-admin protection: cannot demote the last remaining admin.
 *
 * Request body: { role: 'admin' | 'editor' | 'viewer' }
 * Success response: 200 { member: MemberResult }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin / last admin),
 *                  404 (not found), 500 (unexpected)
 */
export const PATCH = apiHandlerWithParams<{ treeId: string; userId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId, userId: targetUserId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const input = await validateBody(request, changeMemberRoleSchema);
    const member = await changeMemberRole(
      treeId,
      targetUserId,
      input.role,
      session.userId
    );

    return Response.json({ member }, { status: 200 });
  }
);

/**
 * DELETE /api/trees/[treeId]/members/[userId]
 *
 * Removes a member from a family tree using soft delete.
 * Requires the authenticated user to have admin role on the tree.
 * Enforces last-admin protection and prevents self-removal.
 *
 * Success response: 200 { member: MemberResult }
 * Error responses: 400 (self-removal), 401 (not authenticated), 403 (not admin / last admin),
 *                  404 (not found), 500 (unexpected)
 */
export const DELETE = apiHandlerWithParams<{ treeId: string; userId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId, userId: targetUserId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const member = await removeMember(treeId, targetUserId, session.userId);

    return Response.json({ member }, { status: 200 });
  }
);

// --- Helpers ---

/**
 * Verifies that the user has an active membership on the tree.
 * Optionally checks for a specific role.
 * Throws NotFoundError (404) if no membership exists — avoids leaking tree existence.
 */
async function verifyMembership(
  userId: string,
  treeId: string,
  requiredRole?: 'admin' | 'editor' | 'viewer'
): Promise<void> {
  if (!Types.ObjectId.isValid(treeId)) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }

  await connectDB();

  const query: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    treeId: new Types.ObjectId(treeId),
    deletedAt: null,
  };

  if (requiredRole) {
    query.role = requiredRole;
  }

  const membership = await Membership.findOne(query);

  if (!membership) {
    throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
  }
}
