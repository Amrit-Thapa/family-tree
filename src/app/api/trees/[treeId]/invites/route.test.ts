import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { AuthError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockCreateInviteLink = vi.fn();
const mockListActiveInvites = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/invite.service', () => ({
  createInviteLink: (...args: unknown[]) => mockCreateInviteLink(...args),
  listActiveInvites: (...args: unknown[]) => mockListActiveInvites(...args),
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

const mockInviteResult = {
  id: 'invite-1',
  treeId: VALID_TREE_ID,
  role: 'editor',
  token: 'abc123def456',
  label: 'For Uncle Raj',
  invitedBy: mockSession.userId,
  status: 'active',
  maxUses: 1,
  usedCount: 0,
  expiresAt: new Date('2025-01-15'),
  createdAt: new Date('2025-01-08'),
  inviteUrl: 'http://localhost:3000/invite/abc123def456',
};

function createContext(treeId: string) {
  return { params: Promise.resolve({ treeId }) };
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/invites`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function createGetRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/invites`,
    {
      method: 'GET',
    }
  );
}

// --- Tests ---

describe('POST /api/trees/[treeId]/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with invite when admin creates invite link', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockCreateInviteLink.mockResolvedValue(mockInviteResult);

    const response = await POST(
      createPostRequest({ role: 'editor', label: 'For Uncle Raj' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.invite.role).toBe('editor');
    expect(data.invite.label).toBe('For Uncle Raj');
    expect(data.invite.inviteUrl).toContain('/invite/');
    expect(mockCreateInviteLink).toHaveBeenCalledWith({
      treeId: VALID_TREE_ID,
      role: 'editor',
      invitedBy: mockSession.userId,
      label: 'For Uncle Raj',
      maxUses: 1,
      expiresInDays: 7,
    });
  });

  it('returns 201 with default maxUses and expiresInDays when not provided', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockCreateInviteLink.mockResolvedValue(mockInviteResult);

    const response = await POST(
      createPostRequest({ role: 'viewer' }),
      createContext(VALID_TREE_ID)
    );

    expect(response.status).toBe(201);
    expect(mockCreateInviteLink).toHaveBeenCalledWith(
      expect.objectContaining({
        maxUses: 1,
        expiresInDays: 7,
      })
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await POST(
      createPostRequest({ role: 'editor' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null);

    const response = await POST(
      createPostRequest({ role: 'editor' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 400 when role is missing', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const response = await POST(
      createPostRequest({}),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when role is invalid', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const response = await POST(
      createPostRequest({ role: 'superadmin' }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when label exceeds max length', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const response = await POST(
      createPostRequest({ role: 'editor', label: 'a'.repeat(101) }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });
});

describe('GET /api/trees/[treeId]/invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with active invites when admin requests', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockListActiveInvites.mockResolvedValue([mockInviteResult]);

    const response = await GET(createGetRequest(), createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invites).toHaveLength(1);
    expect(data.invites[0].role).toBe('editor');
    expect(data.invites[0].status).toBe('active');
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

  it('returns 404 when user is not admin', async () => {
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
