import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/require-session';
import { createRelationship } from '@/lib/services/relationship.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Zod schema for the POST /api/trees/[treeId]/relationships request body.
 * Validates fromNodeId, toNodeId as valid ObjectId strings and type as a valid relationship type.
 */
const createRelationshipBodySchema = z.object({
  fromNodeId: z
    .string()
    .min(1, 'fromNodeId is required')
    .regex(objectIdRegex, 'fromNodeId must be a valid ObjectId'),
  toNodeId: z
    .string()
    .min(1, 'toNodeId is required')
    .regex(objectIdRegex, 'toNodeId must be a valid ObjectId'),
  type: z.enum(['father', 'mother', 'spouse'], {
    message: 'type must be father, mother, or spouse',
  }),
});

/**
 * POST /api/trees/[treeId]/relationships
 *
 * Creates a relationship between two persons in the tree. Admin-only.
 *
 * Request body: { fromNodeId: string, toNodeId: string, type: 'father' | 'mother' | 'spouse' }
 * Success response: 201 { relationship: GraphRelationshipData }
 * Error responses:
 *   - 400 (validation: invalid input, self-relationship)
 *   - 401 (not authenticated)
 *   - 403 (not admin)
 *   - 404 (tree not found, node not found)
 *   - 409 (duplicate relationship)
 *   - 500 (unexpected)
 */
export const POST = apiHandlerWithParams<{ treeId: string }>(
  async (request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Verify user is an admin of this tree
    await verifyTreeMembership(session.userId, treeId, 'admin');

    // Parse and validate request body
    const input = await validateBody(request, createRelationshipBodySchema);

    // Create the relationship via the service layer
    const relationship = await createRelationship(
      treeId,
      input,
      session.userId
    );

    return Response.json({ relationship }, { status: 201 });
  }
);
