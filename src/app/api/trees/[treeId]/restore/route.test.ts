import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockVerifySession = vi.fn();
const mockRestoreTree = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

vi.mock('@/lib/services/tree.service', () => ({
  restoreTree: (...args: unknown[]) => mockRestoreTree(...args),
}));

// --- Helpers ---

const VALID_TREE_ID = '507f1f77bcf86cd799439022';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

function createContext(treeId: string) {
  return { params: Promise.resolve({ treeId }) };
}

function createPostRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/restore`,
    { method: 'POST' }
  );
}

// --- Tests ---

describe('POST /api/trees/[treeId]/restore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with restored tree when user is the deleting admin', async () => {
    const restoredTree = {
      id: VALID_TREE_ID,
      name: 'Smith Family',
      description: 'The Smith family tree',
      createdBy: '507f1f77bcf86cd799439011',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-06-15'),
      deletedAt: null,
      deletedBy: null,
      totalStorageBytes: 0,
      storageLimit: 524288000,
    };

    mockVerifySession.mockResolvedValue(mockSession);
    mockRestoreTree.mockResolvedValue(restoredTree);

    const response = await POST(createPostRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tree.name).toBe('Smith Family');
    expect(data.tree.deletedAt).toBeNull();
    expect(mockRestoreTree).toHaveBeenCalledWith(
      VALID_TREE_ID,
      '507f1f77bcf86cd799439011'
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockVerifySession.mockResolvedValue(null);

    const response = await POST(createPostRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when treeId is invalid ObjectId format', async () => {
    mockVerifySession.mockResolvedValue(mockSession);

    const response = await POST(createPostRequest(), createContext('invalid-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 500 on unexpected errors', async () => {
    mockVerifySession.mockResolvedValue(mockSession);
    mockRestoreTree.mockRejectedValue(new Error('DB error'));

    const response = await POST(createPostRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
