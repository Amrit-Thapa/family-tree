import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import {
  getTree,
  updateTree,
  softDeleteTree,
} from '@/lib/services/tree.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';
import { updateTreeSchema } from '@/lib/validations/tree';

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

    await verifyTreeMembership(session.userId, treeId);

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

    await verifyTreeMembership(session.userId, treeId, 'admin');

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

    await verifyTreeMembership(session.userId, treeId, 'admin');

    const tree = await softDeleteTree(treeId, session.userId);

    return Response.json({ tree }, { status: 200 });
  }
);
