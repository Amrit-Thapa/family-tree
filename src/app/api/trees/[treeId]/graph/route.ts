import { NextRequest } from 'next/server';
import { requireSession } from '@/lib/auth/require-session';
import { getGraphData } from '@/lib/services/graph.service';
import { apiHandlerWithParams } from '@/lib/utils/api-handler';
import { verifyTreeMembership } from '@/lib/utils/verify-tree-membership';

/**
 * GET /api/trees/[treeId]/graph
 *
 * Returns all active tree nodes (with person data) and relationships
 * for rendering the family tree graph visualization.
 *
 * Requires the authenticated user to have an active membership on the tree.
 * Returns 404 (not 403) when user doesn't have access to avoid leaking tree existence.
 *
 * Success response: 200 { nodes: GraphNodeData[], relationships: GraphRelationshipData[] }
 * Error responses: 401 (not authenticated), 404 (not found or no access), 500 (unexpected)
 */
export const GET = apiHandlerWithParams<{ treeId: string }>(
  async (_request: NextRequest, { params }) => {
    const { treeId } = await params;
    const session = await requireSession();

    await verifyTreeMembership(session.userId, treeId);

    const graphData = await getGraphData(treeId);

    return Response.json(graphData, { status: 200 });
  }
);
