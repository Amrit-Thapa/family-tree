import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import { AuthError, ForbiddenError, NotFoundError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockDeleteRelationship = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/relationship.service', () => ({
  deleteRelationship: (...args: unknown[]) => mockDeleteRelationship(...args),
}));

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/models/Membership', () => ({
  default: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

// --- Helpers ---

const VALID_TREE_ID = '507f1f77bcf86cd799439022';
const VALID_RELATIONSHIP_ID = '507f1f77bcf86cd799439033';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

function createContext(treeId: string, relationshipId: string) {
  return { params: Promise.resolve({ treeId, relationshipId }) };
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/relationships/${VALID_RELATIONSHIP_ID}`,
    { method: 'DELETE' }
  );
}

// --- Tests ---

describe('DELETE /api/trees/[treeId]/relationships/[relationshipId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 204 on successful deletion', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockDeleteRelationship.mockResolvedValue(undefined);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );

    expect(response.status).toBe(204);
    expect(mockDeleteRelationship).toHaveBeenCalledWith(
      VALID_TREE_ID,
      VALID_RELATIONSHIP_ID,
      mockSession.userId
    );
  });

  it('returns 204 with no response body', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockDeleteRelationship.mockResolvedValue(undefined);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );

    const body = await response.text();
    expect(body).toBe('');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin (hides tree existence)', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 403 when service rejects non-admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockDeleteRelationship.mockRejectedValue(
      new ForbiddenError('Only an admin can delete relationships', 'NOT_ADMIN')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('NOT_ADMIN');
  });

  it('returns 404 when relationship is not found', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockDeleteRelationship.mockRejectedValue(
      new NotFoundError('Relationship not found in this tree', 'RELATIONSHIP_NOT_FOUND')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_RELATIONSHIP_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('RELATIONSHIP_NOT_FOUND');
  });

  it('returns 404 when treeId is invalid ObjectId format', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const response = await DELETE(
      createDeleteRequest(),
      createContext('invalid-id', VALID_RELATIONSHIP_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });
});
