import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { connectDB } from '@/lib/db/connection';
import Membership from '@/lib/db/models/Membership';
import {
  createInviteLink,
  listActiveInvites,
} from '@/lib/services/invite.service';
import { NotFoundError } from '@/lib/utils/errors';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { createInviteBodySchema } from '@/lib/validations/membership';
import { Types } from 'mongoose';

/**
 * POST /api/trees/[treeId]/invites
 *
 * Generates a new invite link for a family tree.
 * Requires the authenticated user to have admin role on the tree.
 *
 * Request body: { role: 'admin' | 'editor' | 'viewer', label?: string, maxUses?: number, expiresInDays?: number }
 * Success response: 201 { invite: InviteResult }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin),
 *                  404 (not found), 500 (unexpected)
 */
export const POST = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const input = await validateBody(request, createInviteBodySchema);

    const invite = await createInviteLink({
      treeId,
      role: input.role,
      invitedBy: session.userId,
      label: input.label,
      maxUses: input.maxUses,
      expiresInDays: input.expiresInDays,
    });

    return Response.json({ invite }, { status: 201 });
  }
);

/**
 * GET /api/trees/[treeId]/invites
 *
 * Lists all active invite links for a family tree.
 * Requires the authenticated user to have admin role on the tree.
 *
 * Success response: 200 { invites: InviteResult[] }
 * Error responses: 401 (not authenticated), 403 (not admin), 404 (not found), 500 (unexpected)
 */
export const GET = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const invites = await listActiveInvites(treeId, session.userId);

    return Response.json({ invites }, { status: 200 });
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
