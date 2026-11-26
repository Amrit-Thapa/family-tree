import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  AuthError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockAcceptInvite = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/invite.service', () => ({
  acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
}));

// --- Helpers ---

const VALID_TOKEN = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567890abcdef12';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'session-token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockAcceptResult = {
  membershipId: '507f1f77bcf86cd799439033',
  treeId: '507f1f77bcf86cd799439022',
  role: 'editor' as const,
};

function createContext(token: string) {
  return { params: Promise.resolve({ token }) };
}

function createPostRequest(token: string): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/invites/${token}/accept`,
    { method: 'POST' }
  );
}

// --- Tests ---

describe('POST /api/invites/[token]/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with membership when invite is accepted successfully', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockResolvedValue(mockAcceptResult);

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.membership).toEqual(mockAcceptResult);
    expect(mockAcceptInvite).toHaveBeenCalledWith(VALID_TOKEN, mockSession.userId);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when token is not found', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(
      new NotFoundError('Invite link not found or is invalid', 'INVITE_NOT_FOUND')
    );

    const response = await POST(
      createPostRequest('nonexistent-token'),
      createContext('nonexistent-token')
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('INVITE_NOT_FOUND');
  });

  it('returns 400 when invite has expired', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(
      new ValidationError(
        'This invite link has expired. Please request a new invite from the admin.',
        'INVITE_EXPIRED'
      )
    );

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVITE_EXPIRED');
  });

  it('returns 400 when invite has been exhausted (max uses reached)', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(
      new ValidationError(
        'This invite link has reached its maximum number of uses',
        'INVITE_EXHAUSTED'
      )
    );

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVITE_EXHAUSTED');
  });

  it('returns 400 when invite has been revoked', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(
      new ValidationError(
        'This invite link has been revoked',
        'INVITE_REVOKED'
      )
    );

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVITE_REVOKED');
  });

  it('returns 409 when user is already a member of the tree', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(
      new ConflictError(
        'You are already a member of this family tree',
        'ALREADY_MEMBER'
      )
    );

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('ALREADY_MEMBER');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockRejectedValue(new Error('Database connection failed'));

    const response = await POST(
      createPostRequest(VALID_TOKEN),
      createContext(VALID_TOKEN)
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('An unexpected error occurred');
  });

  it('passes the token from URL params to acceptInvite', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockAcceptInvite.mockResolvedValue(mockAcceptResult);

    const customToken = 'my-custom-invite-token-123';
    await POST(
      createPostRequest(customToken),
      createContext(customToken)
    );

    expect(mockAcceptInvite).toHaveBeenCalledWith(customToken, mockSession.userId);
  });
});
