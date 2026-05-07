import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { restoreTree } from '@/lib/services/tree.service';
import { NotFoundError } from '@/lib/utils/errors';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { Types } from 'mongoose';

/**
 * POST /api/trees/[treeId]/restore
 *
 * Restores a soft-deleted family tree within the 30-day restore window.
 * Only the admin who deleted the tree can restore it.
 *
 * Success response: 200 { tree: TreeResult }
 * Error responses: 401 (not authenticated), 403 (not the deleting admin), 404 (not found or not deleted), 400 (restore window expired), 500 (unexpected)
 */
export const POST = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    // Validate treeId format
    if (!Types.ObjectId.isValid(treeId)) {
      throw new NotFoundError('Family tree not found', 'TREE_NOT_FOUND');
    }

    const tree = await restoreTree(treeId, session.userId);

    return Response.json({ tree }, { status: 200 });
  }
);
