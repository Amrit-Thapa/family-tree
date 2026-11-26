import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  AuthError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@/lib/utils/errors';

// --- Mocks ---

const mockRequireSession = vi.fn();
const mockCreateRelationship = vi.fn();
const mockFindOne = vi.fn();

vi.mock('@/lib/auth/require-session', () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

vi.mock('@/lib/services/relationship.service', () => ({
  createRelationship: (...args: unknown[]) => mockCreateRelationship(...args),
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
const VALID_FROM_NODE_ID = '507f1f77bcf86cd799439033';
const VALID_TO_NODE_ID = '507f1f77bcf86cd799439044';

const mockSession = {
  sessionId: 'session-123',
  userId: '507f1f77bcf86cd799439011',
  token: 'token-abc',
  expiresAt: new Date('2025-01-08T00:00:00.000Z'),
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
};

const mockRelationshipResult = {
  id: '507f1f77bcf86cd799439055',
  fromNodeId: VALID_FROM_NODE_ID,
  toNodeId: VALID_TO_NODE_ID,
  type: 'father' as const,
};

function createContext(treeId: string) {
  return { params: Promise.resolve({ treeId }) };
}

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/trees/${VALID_TREE_ID}/relationships`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

// --- Tests ---

describe('POST /api/trees/[treeId]/relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 201 with created relationship when admin submits valid input', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockCreateRelationship.mockResolvedValue(mockRelationshipResult);

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.relationship).toEqual(mockRelationshipResult);
    expect(mockCreateRelationship).toHaveBeenCalledWith(
      VALID_TREE_ID,
      {
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      },
      mockSession.userId
    );
  });

  it('returns 201 for spouse relationship type', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    const spouseResult = { ...mockRelationshipResult, type: 'spouse' };
    mockCreateRelationship.mockResolvedValue(spouseResult);

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'spouse',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.relationship.type).toBe('spouse');
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireSession.mockRejectedValue(
      new AuthError('Not authenticated', 'NOT_AUTHENTICATED')
    );

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 404 when user is not admin (membership check fails)', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('TREE_NOT_FOUND');
  });

  it('returns 400 when fromNodeId is missing', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });

    const response = await POST(
      createPostRequest({
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when toNodeId is missing', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when type is invalid', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'sibling',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when fromNodeId is not a valid ObjectId', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });

    const response = await POST(
      createPostRequest({
        fromNodeId: 'not-a-valid-id',
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
  });

  it('returns 400 when service throws ValidationError (self-relationship)', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockCreateRelationship.mockRejectedValue(
      new ValidationError(
        'Cannot create a relationship between a person and themselves',
        'SELF_RELATIONSHIP',
        { field: 'toNodeId' }
      )
    );

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_FROM_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('SELF_RELATIONSHIP');
  });

  it('returns 403 when service throws ForbiddenError', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockCreateRelationship.mockRejectedValue(
      new ForbiddenError('Only an admin can create relationships', 'NOT_ADMIN')
    );

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('NOT_ADMIN');
  });

  it('returns 409 when service throws ConflictError (duplicate)', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });
    mockCreateRelationship.mockRejectedValue(
      new ConflictError(
        'A relationship of this type already exists between these persons',
        'DUPLICATE_RELATIONSHIP'
      )
    );

    const response = await POST(
      createPostRequest({
        fromNodeId: VALID_FROM_NODE_ID,
        toNodeId: VALID_TO_NODE_ID,
        type: 'father',
      }),
      createContext(VALID_TREE_ID)
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('DUPLICATE_RELATIONSHIP');
  });

  it('returns 400 when request body is not valid JSON', async () => {
    mockRequireSession.mockResolvedValue(mockSession);
    mockFindOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ _id: 'membership-1', role: 'admin' }),
    });

    const request = new NextRequest(
      `http://localhost:3000/api/trees/${VALID_TREE_ID}/relationships`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }
    );

    const response = await POST(request, createContext(VALID_TREE_ID));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_JSON');
  });
});
