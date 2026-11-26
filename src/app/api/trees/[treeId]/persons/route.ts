import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { createProfileOnlyPerson } from '@/lib/services/person.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';
import { createProfileOnlyPersonSchema } from '@/lib/validations/person';

/**
 * POST /api/trees/[treeId]/persons
 *
 * Creates a profile-only person node (no linked user account).
 * Used by admins to add ancestors or deceased family members to the tree.
 *
 * Requires the authenticated user to have admin role on the tree.
 *
 * Request body: { firstName: string, lastName?: string, dateOfBirth?: string, dateOfDeath?: string, gender?: string }
 * Success response: 201 { node: GraphNodeData }
 * Error responses: 400 (validation), 401 (not authenticated), 403 (not admin), 500 (unexpected)
 */
export const POST = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify user is an admin of this tree
    await verifyTreeMembership(session.userId, treeId, 'admin');

    // Parse and validate request body
    const input = await validateBody(request, createProfileOnlyPersonSchema);

    // Create the profile-only person node
    const node = await createProfileOnlyPerson(treeId, {
      firstName: input.firstName,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
      dateOfDeath: input.dateOfDeath,
      gender: input.gender,
    }, session.userId);

    return Response.json({ node }, { status: 201 });
  }
);
