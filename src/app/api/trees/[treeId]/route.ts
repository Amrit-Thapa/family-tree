import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { connectDB } from '@/lib/db/connection';
import Membership from '@/lib/db/models/Membership';
import {
  getTree,
  updateTree,
  softDeleteTree,
} from '@/lib/services/tree.service';
import { NotFoundError } from '@/lib/utils/errors';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { updateTreeSchema } from '@/lib/validations/tree';
import { Types } from 'mongoose';

/**
 * GET /api/trees/[treeId]
 *
 * Returns the details of a specific family tree.
 * Requires the authenticated user to have an active membership on the tree.
 * Returns 404 (not 403) when user doesn't have access to avoid leaking tree existence.
 *
 * Success response: 200 { tree: TreeResult }
 * Error responses: 401 (not authenticated), 404 (not found or no access), 500 (unexpected)
 */
export const GET = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify membership — return 404 if no access (don't leak tree existence)
    await verifyMembership(session.userId, treeId);

    const tree = await getTree(treeId);

    return Response.json({ tree }, { status: 200 });
  }
);

/**
 * PATCH /api/trees/[treeId]
 *
 * Updates a family tree's name and/or description.
 * Requires the authenticated user to have admin role on the tree.
 *
 * Request body: { name?: string, description?: string }
 * Success response: 200 { tree: TreeResult }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin), 404 (not found), 409 (name conflict), 500 (unexpected)
 */
export const PATCH = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const input = await validateBody(request, updateTreeSchema);
    const tree = await updateTree(treeId, session.userId, input);

    return Response.json({ tree }, { status: 200 });
  }
);

/**
 * DELETE /api/trees/[treeId]
 *
 * Soft-deletes a family tree. Only the sole admin can delete a tree.
 * Sets deletedAt and deletedBy fields. Tree can be restored within 30 days.
 *
 * Success response: 200 { tree: TreeResult }
 * Error responses: 401 (not authenticated), 403 (not sole admin), 404 (not found), 500 (unexpected)
 */
export const DELETE = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify admin membership — return 404 if no access
    await verifyMembership(session.userId, treeId, 'admin');

    const tree = await softDeleteTree(treeId, session.userId);

    return Response.json({ tree }, { status: 200 });
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
