import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { AuthError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockGetMembers = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/membership.service', () => ({
  getMembers: (...args: unknown[]) => mockGetMembers(...args),
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

const mockMembers = [
  {
    id: 'member-1',
    userId: '507f1f77bcf86cd799439011',
    treeId: VALID_TREE_ID,
    role: 'admin',
    joinedAt: new Date('2024-01-01'),
    invitedBy: null,
  },
  {
    id: 'member-2',
    userId: '507f1f77bcf86cd799439033',
    treeId: VALID_TREE_ID,
    role: 'editor',
    joinedAt: new Date('2024-02-01'),
    invitedBy: '507f1f77bcf86cd799439011',
  },
];

function createContext(treeId: string) {
  return { params: Promise.resolve({ treeId }) };
}

function createGetRequest(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/trees/${VALID_TREE_ID}/members`, {
    method: 'GET',
  });
}

// --- Tests ---

describe('GET /api/trees/[treeId]/members', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with members list when user has membership', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'editor' }) });
    mockGetMembers.mockResolvedValue(mockMembers);

    const response = await GET(createGetRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.members).toHaveLength(2);
    expect(data.members[0].role).toBe('admin');
    expect(data.members[1].role).toBe('editor');
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
    mockFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

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
