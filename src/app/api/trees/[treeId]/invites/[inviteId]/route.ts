import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { connectDB } from '@/lib/db/connection';
import Membership from '@/lib/db/models/Membership';
import { revokeInvite } from '@/lib/services/invite.service';
import { NotFoundError } from '@/lib/utils/errors';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { Types } from 'mongoose';

/**
 * DELETE /api/trees/[treeId]/invites/[inviteId]
 *
 * Revokes an active invite link.
 * Requires the authenticated user to have admin role on the tree.
 *
 * Success response: 200 { invite: InviteResult }
 * Error responses: 400 (invite not active), 401 (not authenticated), 403 (not admin),
 *                  404 (not found), 500 (unexpected)
 */
export const DELETE = apiHandlerWithParams<{ treeId: string; inviteId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId, inviteId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const invite = await revokeInvite(inviteId, session.userId);

    return Response.json({ invite }, { status: 200 });
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
