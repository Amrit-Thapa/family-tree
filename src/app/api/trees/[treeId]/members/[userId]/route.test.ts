import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from './route';
import { NextRequest } from 'next/server';
import { AuthError, ForbiddenError, ValidationError } from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockChangeMemberRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/membership.service', () => ({
  changeMemberRole: (...args: unknown[]) => mockChangeMemberRole(...args),
  removeMember: (...args: unknown[]) => mockRemoveMember(...args),
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
const TARGET_USER_ID = '507f1f77bcf86cd799439033';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockMemberResult = {
  id: 'membership-1',
  userId: TARGET_USER_ID,
  treeId: VALID_TREE_ID,
  role: 'editor',
  joinedAt: new Date('2024-02-01'),
  invitedBy: '507f1f77bcf86cd799439011',
};

function createContext(treeId: string, userId: string) {
  return { params: Promise.resolve({ treeId, userId }) };
}

function createPatchRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/members/${TARGET_USER_ID}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function createDeleteRequest(): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/members/${TARGET_USER_ID}`,
    {
      method: 'DELETE',
    }
  );
}

// --- Tests ---

describe('PATCH /api/trees/[treeId]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with updated member when admin changes role', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockChangeMemberRole.mockResolvedValue({ ...mockMemberResult, role: 'viewer' });

    const response = await PATCH(
      createPatchRequest({ role: 'viewer' }),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.member.role).toBe('viewer');
    expect(mockChangeMemberRole).toHaveBeenCalledWith(
      VALID_TREE_ID,
      TARGET_USER_ID,
      'viewer',
      mockSession.userId
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await PATCH(
      createPatchRequest({ role: 'viewer' }),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue(null);

    const response = await PATCH(
      createPatchRequest({ role: 'viewer' }),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 400 when role is invalid', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const response = await PATCH(
      createPatchRequest({ role: 'superadmin' }),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when body is not valid JSON', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });

    const request = new NextRequest(
      `http://localhost:3000/api/trees/${VALID_TREE_ID}/members/${TARGET_USER_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }
    );
    const response = await PATCH(request, createContext(VALID_TREE_ID, TARGET_USER_ID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_JSON');
  });

  it('returns 403 when trying to demote last admin', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockChangeMemberRole.mockRejectedValue(
      new ForbiddenError(
        'Cannot remove or demote the last admin. Promote another member to admin first.',
        'LAST_ADMIN_DEMOTION'
      )
    );

    const response = await PATCH(
      createPatchRequest({ role: 'editor' }),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('LAST_ADMIN_DEMOTION');
  });
});

describe('DELETE /api/trees/[treeId]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with removed member when admin removes a member', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockRemoveMember.mockResolvedValue(mockMemberResult);

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.member.userId).toBe(TARGET_USER_ID);
    expect(mockRemoveMember).toHaveBeenCalledWith(
      VALID_TREE_ID,
      TARGET_USER_ID,
      mockSession.userId
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, TARGET_USER_ID)
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
      createContext(VALID_TREE_ID, TARGET_USER_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 400 when admin tries to remove themselves', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockResolvedValue({ role: 'admin' });
    mockRemoveMember.mockRejectedValue(
      new ValidationError(
        'Cannot remove yourself. Use the "Leave tree" option instead.',
        'SELF_REMOVAL',
        { field: 'targetUserId' }
      )
    );

    const response = await DELETE(
      createDeleteRequest(),
      createContext(VALID_TREE_ID, mockSession.userId)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('SELF_REMOVAL');
  });
});
