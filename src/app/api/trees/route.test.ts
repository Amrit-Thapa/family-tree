import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { AuthError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockListUserTrees = vi.fn();
const mockCreateTree = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/tree.service', () => ({
  listUserTrees: (...args: unknown[]) => mockListUserTrees(...args),
  createTree: (...args: unknown[]) => mockCreateTree(...args),
}));

// --- Helpers ---

function createGetRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/trees', {
    method: 'GET',
  });
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

// --- Tests ---

describe('GET /api/trees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with list of trees when authenticated', async () => {
    const mockTrees = [
      {
        id: '507f1f77bcf86cd799439022',
        name: 'Smith Family',
        description: 'The Smith family tree',
        createdBy: '507f1f77bcf86cd799439011',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        deletedAt: null,
        deletedBy: null,
        totalStorageBytes: 0,
        storageLimit: 524288000,
      },
    ];

    mockRequireSession.mockResolvedValue(mockSession);
    mockListUserTrees.mockResolvedValue(mockTrees);

    const request = createGetRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.trees).toHaveLength(1);
    expect(data.trees[0].name).toBe('Smith Family');
    expect(mockListUserTrees).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const request = createGetRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 500 on unexpected errors', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockListUserTrees.mockRejectedValue(new Error('DB error'));

    const request = createGetRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});

describe('POST /api/trees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with created tree and membership', async () => {
    const mockResult = {
      tree: {
        id: '507f1f77bcf86cd799439022',
        name: 'New Family',
        description: 'A new tree',
        createdBy: '507f1f77bcf86cd799439011',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        deletedAt: null,
        deletedBy: null,
        totalStorageBytes: 0,
        storageLimit: 524288000,
      },
      membership: {
        id: '507f1f77bcf86cd799439033',
        userId: '507f1f77bcf86cd799439011',
        treeId: '507f1f77bcf86cd799439022',
        role: 'admin',
        joinedAt: new Date('2024-01-01'),
      },
    };

    mockRequireSession.mockResolvedValue(mockSession);
    mockCreateTree.mockResolvedValue(mockResult);

    const request = createPostRequest({ name: 'New Family', description: 'A new tree' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.tree.name).toBe('New Family');
    expect(data.membership.role).toBe('admin');
    expect(mockCreateTree).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
      name: 'New Family',
      description: 'A new tree',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const request = createPostRequest({ name: 'Test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/trees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_JSON');
  });

  it('returns 400 when name is missing', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const request = createPostRequest({ description: 'No name' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when name is empty string', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const request = createPostRequest({ name: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockRequireSession.mockResolvedValue(mockSession);

    const request = createPostRequest({ name: 'a'.repeat(101) });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });
});
