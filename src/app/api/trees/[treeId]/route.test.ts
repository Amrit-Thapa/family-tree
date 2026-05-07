import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from './route';
import { NextRequest } from 'next/server';
import { AuthError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockGetTree = vi.fn();
const mockUpdateTree = vi.fn();
const mockSoftDeleteTree = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/tree.service', () => ({
  getTree: (...args: unknown[]) => mockGetTree(...args),
  updateTree: (...args: unknown[]) => mockUpdateTree(...args),
  softDeleteTree: (...args: unknown[]) => mockSoftDeleteTree(...args),
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

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockTreeResult = {
  id: VALID_TREE_ID,
  name: 'Smith Family',
  description: 'The Smith family tree',
  createdBy: '507f1f77bcf86cd799439011',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-06-01'),
  deletedAt: null,
  deletedBy: null,
  totalStorageBytes: 0,
  storageLimit: 524288000,
};

function createContext(treeId: string) {
  return { params: Promise.resolve({ treeId }) };
}

function createGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/trees/${VALID_TREE_ID}`, {
    method: 'GET',
  });
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/trees/${VALID_TREE_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/trees/${VALID_TREE_ID}`, {
    method: 'DELETE',
  });
}

// --- Tests ---

describe('GET /api/trees/[treeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with tree details when user has membership', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockGetTree.mockResolvedValue(mockTreeResult);

    const response = await GET(createGetRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tree.name).toBe('Smith Family');
    expect(data.tree.id).toBe(VALID_TREE_ID);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await GET(createGetRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user has no membership on the tree', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null);

    const response = await GET(createGetRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 404 when treeId is invalid ObjectId format', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const response = await GET(createGetRequest(), createContext('invalid-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });
});

describe('PATCH /api/trees/[treeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with updated tree when user is admin', async () => {
    const updatedTree = { ...mockTreeResult, name: 'Updated Name' };

    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockUpdateTree.mockResolvedValue(updatedTree);

    const response = await PATCH(
      createPatchRequest({ name: 'Updated Name' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tree.name).toBe('Updated Name');
    expect(mockUpdateTree).toHaveBeenCalledWith(
      VALID_TREE_ID,
      '507f1f77bcf86cd799439011',
      { name: 'Updated Name' }
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await PATCH(
      createPatchRequest({ name: 'Test' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null); // No admin membership found

    const response = await PATCH(
      createPatchRequest({ name: 'Test' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const request = new NextRequest(
      `http://localhost:3000/api/trees/${VALID_TREE_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }
    );
    const response = await PATCH(request, createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_JSON');
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const response = await PATCH(
      createPatchRequest({ name: 'a'.repeat(101) }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });
});

describe('DELETE /api/trees/[treeId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with soft-deleted tree when user is sole admin', async () => {
    const deletedTree = {
      ...mockTreeResult,
      deletedAt: new Date('2024-06-15'),
      deletedBy: '507f1f77bcf86cd799439011',
    };

    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockSoftDeleteTree.mockResolvedValue(deletedTree);

    const response = await DELETE(createDeleteRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tree.deletedAt).toBeTruthy();
    expect(mockSoftDeleteTree).toHaveBeenCalledWith(
      VALID_TREE_ID,
      '507f1f77bcf86cd799439011'
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await DELETE(createDeleteRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null);

    const response = await DELETE(createDeleteRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });
});
