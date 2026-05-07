import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockGetCurrentUser = vi.fn();

vi.mock('@/lib/services/auth.service', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// --- Helpers ---

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/me', {
    method: 'GET',
  });
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with user profile when authenticated', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      notificationPreferences: {
        invites: true,
        claims: true,
        membershipChanges: true,
        treeUpdates: true,
        crossTreeEdits: true,
      },
    };

    mockGetCurrentUser.mockResolvedValue(mockUser);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe('507f1f77bcf86cd799439011');
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.displayName).toBe('Test User');
    expect(data.user.photoURL).toBe('https://example.com/photo.jpg');
    expect(data.user.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(data.user.notificationPreferences).toEqual({
      invites: true,
      claims: true,
      membershipChanges: true,
      treeUpdates: true,
      crossTreeEdits: true,
    });
    expect(mockGetCurrentUser).toHaveBeenCalledOnce();
  });

  it('returns 200 with user profile without optional photoURL', async () => {
    const mockUser = {
      id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: undefined,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      notificationPreferences: {
        invites: true,
        claims: true,
        membershipChanges: true,
        treeUpdates: false,
        crossTreeEdits: false,
      },
    };

    mockGetCurrentUser.mockResolvedValue(mockUser);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe('507f1f77bcf86cd799439011');
    expect(data.user.photoURL).toBeUndefined();
    expect(data.user.notificationPreferences.treeUpdates).toBe(false);
  });

  it('returns 401 when no valid session exists', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('NOT_AUTHENTICATED');
    expect(data.error.message).toBe('Not authenticated');
  });

  it('returns 500 on unexpected errors', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('An unexpected error occurred');
  });
});
