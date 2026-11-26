import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockVerifyTreeMembership = vi.fn();
const mockGetGraphData = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/utils/verify-tree-membership', () => ({
  verifyTreeMembership: (...args: unknown[]) =>
    mockVerifyTreeMembership(...args),
}));

vi.mock('@/lib/services/graph.service', () => ({
  getGraphData: (...args: unknown[]) => mockGetGraphData(...args),
}));

// --- Helpers ---

const TREE_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439022';

function createRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${TREE_ID}/graph`,
    { method: 'GET' }
  );
}

function createParams(): { params: Promise<{ treeId: string }> } {
  return { params: Promise.resolve({ treeId: TREE_ID }) };
}

describe('GET /api/trees/[treeId]/graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ userId: USER_ID });
    mockVerifyTreeMembership.mockResolvedValue({
      role: 'admin',
      membershipId: '507f1f77bcf86cd799439033',
    });
  });

  it('returns 200 with graph data when user has membership', async () => {
    const mockGraphData = {
      nodes: [
        {
          id: 'node1',
          personId: 'person1',
          firstName: 'John',
          lastName: 'Doe',
          linkedUserId: USER_ID,
        },
        {
          id: 'node2',
          personId: 'person2',
          firstName: 'Jane',
          lastName: 'Doe',
        },
      ],
      relationships: [
        {
          id: 'rel1',
          fromNodeId: 'node1',
          toNodeId: 'node2',
          type: 'father',
        },
      ],
    };

    mockGetGraphData.mockResolvedValue(mockGraphData);

    const request = createRequest();
    const response = await GET(request, createParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(2);
    expect(data.relationships).toHaveLength(1);
    expect(data.nodes[0].firstName).toBe('John');
    expect(data.relationships[0].type).toBe('father');
    expect(mockRequireSession).toHaveBeenCalledOnce();
    expect(mockVerifyTreeMembership).toHaveBeenCalledWith(USER_ID, TREE_ID);
    expect(mockGetGraphData).toHaveBeenCalledWith(TREE_ID);
  });

  it('returns 200 with empty graph when tree has no nodes', async () => {
    mockGetGraphData.mockResolvedValue({ nodes: [], relationships: [] });

    const request = createRequest();
    const response = await GET(request, createParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(0);
    expect(data.relationships).toHaveLength(0);
  });

  it('returns 401 when user is not authenticated', async () => {
    const { AuthError } = await import('@/lib/utils/errors');
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const request = createRequest();
    const response = await GET(request, createParams());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user has no membership on the tree', async () => {
    const { NotFoundError } = await import('@/lib/utils/errors');
    mockVerifyTreeMembership.mockRejectedValue(
      new NotFoundError('Family tree not found', 'TREE_NOT_FOUND')
    );

    const request = createRequest();
    const response = await GET(request, createParams());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 500 on unexpected errors', async () => {
    mockGetGraphData.mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest();
    const response = await GET(request, createParams());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('An unexpected error occurred');
  });
});
