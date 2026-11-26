import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import { AuthError, NotFoundError, ValidationError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockRevokeInvite = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/invite.service', () => ({
  revokeInvite: (...args: unknown[]) => mockRevokeInvite(...args),
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
const VALID_INVITE_ID = '507f1f77bcf86cd799439044';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockRevokedInvite = {
  id: VALID_INVITE_ID,
  treeId: VALID_TREE_ID,
  role: 'editor',
  token: 'abc123def456',
  label: 'For Uncle Raj',
  invitedBy: mockSession.userId,
  status: 'revoked',
  maxUses: 1,
  usedCount: 0,
  expiresAt: new Date('2025-01-15'),
  createdAt: new Date('2025-01-08'),
  inviteUrl: 'http://localhost:3000/invite/abc123def456',
};

function createContext(treeId: string, inviteId: string) {
  return { params: Promise.resolve({ treeId, inviteId }) };
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/invites/${VALID_INVITE_ID}`,
    {
      method: 'DELETE',
    }
  );
}

// --- Tests ---

describe('DELETE /api/trees/[treeId]/invites/[inviteId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with revoked invite when admin revokes', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockRevokeInvite.mockResolvedValue(mockRevokedInvite);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_INVITE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.invite.status).toBe('revoked');
    expect(mockRevokeInvite).toHaveBeenCalledWith(
      VALID_INVITE_ID,
      mockSession.userId
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_INVITE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_INVITE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 404 when invite does not exist', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockRevokeInvite.mockRejectedValue(
      new NotFoundError('Invite not found', 'INVITE_NOT_FOUND')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_INVITE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('INVITE_NOT_FOUND');
  });

  it('returns 400 when invite is already revoked', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockRevokeInvite.mockRejectedValue(
      new ValidationError(
        'Cannot revoke an invite that is already revoked',
        'INVITE_NOT_ACTIVE'
      )
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, VALID_INVITE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVITE_NOT_ACTIVE');
  });
});
