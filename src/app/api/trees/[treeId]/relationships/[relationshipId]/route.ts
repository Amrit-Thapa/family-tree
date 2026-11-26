import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { deleteRelationship } from '@/lib/services/relationship.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';

/**
 * DELETE /api/trees/[treeId]/relationships/[relationshipId]
 *
 * Soft-deletes a relationship between two persons in the tree.
 * Requires the authenticated user to have admin role on the tree.
 *
 * Success response: 204 No Content
 * Error responses: 401 (not authenticated), 403 (not admin), 404 (not found), 500 (unexpected)
 */
export const DELETE = apiHandlerWithParams<{
  treeId: string;
  relationshipId: string;
}>(async (_request: NextRequest, { params }) => {
  const { treeId, relationshipId } = await params;
  const session = await requireSession();

  await verifyTreeMembership(session.userId, treeId, 'admin');

  await deleteRelationship(treeId, relationshipId, session.userId);

  return new Response(null, { status: 204 });
});
