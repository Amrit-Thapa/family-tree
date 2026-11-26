import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { updatePerson, deletePerson } from '@/lib/services/person.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';
import { createProfileOnlyPersonSchema } from '@/lib/validations/person';

// Use the same schema as create but make all fields optional for updates
const updatePersonBodySchema = createProfileOnlyPersonSchema.partial();

/**
 * PUT /api/trees/[treeId]/persons/[nodeId]
 *
 * Updates a person's details.
 * Allowed by: admin of the tree, OR the person themselves (linkedUserId matches current user).
 *
 * Request body: { firstName?: string, lastName?: string, dateOfBirth?: string, dateOfDeath?: string, gender?: string }
 * Success response: 200 { node: GraphNodeData }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin and not own node), 404 (not found)
 */
export const PUT = apiHandlerWithParams<{ treeId: string; nodeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId, nodeId } = await params;
    const session = await requireSession();

    // Verify user is at least a member of this tree
    await verifyTreeMembership(session.userId, treeId);

    // Parse and validate request body
    const input = await validateBody(request, updatePersonBodySchema);

    // Update the person (service handles admin/self authorization)
    const node = await updatePerson(treeId, nodeId, {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      dateOfDeath: input.dateOfDeath,
      gender: input.gender,
    }, session.userId);

    return Response.json({ node }, { status: 200 });
  }
);

/**
 * DELETE /api/trees/[treeId]/persons/[nodeId]
 *
 * Permanently deletes a person node, their Person record, and all related relationships.
 * Admin-only.
 *
 * Success response: 204 No Content
 * Error responses: 401 (not authenticated), 403 (not admin), 404 (not found)
 */
export const DELETE = apiHandlerWithParams<{ treeId: string; nodeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId, nodeId } = await params;
    const session = await requireSession();

    // Verify user is an admin of this tree
    await verifyTreeMembership(session.userId, treeId, 'admin');

    // Delete the person (service handles all cleanup)
    await deletePerson(treeId, nodeId, session.userId);

    return new Response(null, { status: 204 });
  }
);
