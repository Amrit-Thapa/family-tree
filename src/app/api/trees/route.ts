import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { createTree, listUserTrees } from '@/lib/services/tree.service';
import { apiHandler } from '@/lib/utils/api-handler';
import { validateBody } from '@/lib/utils/validate-body';
import { createTreeSchema } from '@/lib/validations/tree';

/**
 * GET /api/trees
 *
 * Lists all active family trees where the authenticated user has a membership.
 * Returns trees sorted by most recently updated.
 *
 * Success response: 200 { trees: TreeResult[] }
 * Error responses: 401 (not authenticated), 500 (unexpected)
 */
export const GET = apiHandler(async (_request: NextRequest) => {
  const session = await requireSession();
  const trees = await listUserTrees(session.userId);

  return Response.json({ trees }, { status: 200 });
});

/**
 * POST /api/trees
 *
 * Creates a new family tree for the authenticated user.
 * Automatically creates an admin membership for the creator.
 *
 * Request body: { name: string, description?: string }
 * Success response: 201 { tree: TreeResult, membership: MembershipResult }
 * Error responses: 400 (validation), 401 (not authenticated), 409 (name conflict), 500 (unexpected)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const session = await requireSession();
  const input = await validateBody(request, createTreeSchema);
  const result = await createTree(session.userId, input);

  return Response.json(
    { tree: result.tree, membership: result.membership },
    { status: 201 }
  );
});
