import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

const mockVerifySession = vi.fn();
const mockConnectDB = vi.fn();
const mockFindById = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

vi.mock('@/lib/db/connection', () => ({
  connectDB: (...args: unknown[]) => mockConnectDB(...args),
}));

vi.mock('@/lib/db/models/User', () => ({
  default: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

// Import the layout after mocks are set up
import ProtectedLayout from './layout';

describe('ProtectedLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectDB.mockResolvedValue(undefined);
  });

  it('redirects to /auth/signin when session is null', async () => {
    mockVerifySession.mockResolvedValue(null);

    await expect(
      ProtectedLayout({ children: null })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('redirects to /auth/signin when user is not found', async () => {
    mockVerifySession.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-1',
      token: 'token-1',
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    mockFindById.mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await expect(
      ProtectedLayout({ children: null })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('redirects to /auth/signin when user is soft-deleted', async () => {
    mockVerifySession.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-1',
      token: 'token-1',
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    mockFindById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: { toString: () => 'user-1' },
          displayName: 'Test User',
          email: 'test@example.com',
          photoURL: null,
          deletedAt: new Date(),
        }),
    });

    await expect(
      ProtectedLayout({ children: null })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin');
  });

  it('does not redirect when session and user are valid', async () => {
    mockVerifySession.mockResolvedValue({
      sessionId: 'session-1',
      userId: 'user-1',
      token: 'token-1',
      expiresAt: new Date(),
      createdAt: new Date(),
    });
    mockFindById.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: { toString: () => 'user-1' },
          displayName: 'Test User',
          email: 'test@example.com',
          photoURL: 'https://example.com/photo.jpg',
          deletedAt: null,
        }),
    });

    const result = await ProtectedLayout({ children: 'child content' });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
