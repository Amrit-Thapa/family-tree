import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createSession,
  verifySession,
  refreshSession,
  invalidateSession,
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  REFRESH_THRESHOLD_MS,
} from './session';

// --- Mocks ---

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

// Mock DB connection
vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

// Mock Session model
const mockSessionCreate = vi.fn();
const mockSessionFindOne = vi.fn();
const mockSessionFindOneAndUpdate = vi.fn();
const mockSessionDeleteOne = vi.fn();

vi.mock('@/lib/db/models/Session', () => ({
  default: {
    create: (...args: unknown[]) => mockSessionCreate(...args),
    findOne: (...args: unknown[]) => mockSessionFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockSessionFindOneAndUpdate(...args),
    deleteOne: (...args: unknown[]) => mockSessionDeleteOne(...args),
  },
}));

// Mock crypto.randomUUID
vi.mock('crypto', () => ({
  default: {
    randomUUID: () => 'test-uuid-token-1234',
  },
}));

describe('session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  describe('createSession', () => {
    it('creates a session in the database and sets an HttpOnly cookie', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const fakeSession = {
        _id: { toString: () => 'session-id-123' },
        userId: { toString: () => userId },
        token: 'test-uuid-token-1234',
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
        createdAt: new Date(),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockSessionCreate.mockResolvedValue(fakeSession);

      const result = await createSession(userId, {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      // Verify session was created in DB
      expect(mockSessionCreate).toHaveBeenCalledWith({
        userId,
        token: 'test-uuid-token-1234',
        expiresAt: expect.any(Date),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      });

      // Verify cookie was set with correct options
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        COOKIE_NAME,
        'test-uuid-token-1234',
        {
          httpOnly: true,
          secure: false, // NODE_ENV is 'test'
          sameSite: 'strict',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
        }
      );

      // Verify returned data
      expect(result.userId).toBe(userId);
      expect(result.token).toBe('test-uuid-token-1234');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.ipAddress).toBe('192.168.1.1');
    });

    it('uses default 7-day expiry when no maxAge is provided', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const now = Date.now();
      const expectedExpiry = new Date(now + SESSION_MAX_AGE_SECONDS * 1000);

      mockSessionCreate.mockResolvedValue({
        _id: { toString: () => 'session-id' },
        userId: { toString: () => userId },
        token: 'test-uuid-token-1234',
        expiresAt: expectedExpiry,
        createdAt: new Date(now),
      });

      await createSession(userId);

      const createCall = mockSessionCreate.mock.calls[0][0];
      expect(createCall.expiresAt.getTime()).toBe(expectedExpiry.getTime());
    });

    it('accepts a custom maxAge option', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const customMaxAge = 3600; // 1 hour

      mockSessionCreate.mockResolvedValue({
        _id: { toString: () => 'session-id' },
        userId: { toString: () => userId },
        token: 'test-uuid-token-1234',
        expiresAt: new Date(Date.now() + customMaxAge * 1000),
        createdAt: new Date(),
      });

      await createSession(userId, { maxAge: customMaxAge });

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        COOKIE_NAME,
        'test-uuid-token-1234',
        expect.objectContaining({ maxAge: customMaxAge })
      );
    });
  });

  describe('verifySession', () => {
    it('returns session data when a valid session cookie exists', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-token' });

      const fakeSession = {
        _id: { toString: () => 'session-id-123' },
        userId: { toString: () => '507f1f77bcf86cd799439011' },
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        userAgent: 'Chrome',
        ipAddress: '10.0.0.1',
      };

      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeSession),
      });

      const result = await verifySession();

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('507f1f77bcf86cd799439011');
      expect(result!.token).toBe('valid-token');
    });

    it('returns null when no session cookie is present', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      const result = await verifySession();

      expect(result).toBeNull();
      expect(mockSessionFindOne).not.toHaveBeenCalled();
    });

    it('returns null when session cookie has empty value', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });

      const result = await verifySession();

      expect(result).toBeNull();
    });

    it('returns null when session is not found in the database', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'expired-token' });

      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await verifySession();

      expect(result).toBeNull();
    });

    it('queries for non-expired sessions only', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'some-token' });

      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      await verifySession();

      expect(mockSessionFindOne).toHaveBeenCalledWith({
        token: 'some-token',
        expiresAt: { $gt: expect.any(Date) },
      });
    });
  });

  describe('refreshSession', () => {
    it('refreshes a session that is within 24 hours of expiration', async () => {
      // Session expires in 12 hours (within 24h threshold)
      const session = {
        sessionId: 'session-id',
        userId: 'user-id',
        token: 'refresh-token',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      mockSessionFindOneAndUpdate.mockResolvedValue({
        token: 'refresh-token',
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      });

      const result = await refreshSession(session);

      expect(result).toBe(true);
      expect(mockSessionFindOneAndUpdate).toHaveBeenCalledWith(
        { token: 'refresh-token', expiresAt: { $gt: expect.any(Date) } },
        { expiresAt: expect.any(Date) },
        { new: true }
      );
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        COOKIE_NAME,
        'refresh-token',
        expect.objectContaining({ maxAge: SESSION_MAX_AGE_SECONDS })
      );
    });

    it('does not refresh a session that is not within 24 hours of expiration', async () => {
      // Session expires in 5 days (well beyond 24h threshold)
      const session = {
        sessionId: 'session-id',
        userId: 'user-id',
        token: 'fresh-token',
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      const result = await refreshSession(session);

      expect(result).toBe(false);
      expect(mockSessionFindOneAndUpdate).not.toHaveBeenCalled();
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('returns false if the session no longer exists in the database', async () => {
      const session = {
        sessionId: 'session-id',
        userId: 'user-id',
        token: 'gone-token',
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000), // 10h left
        createdAt: new Date(),
      };

      mockSessionFindOneAndUpdate.mockResolvedValue(null);

      const result = await refreshSession(session);

      expect(result).toBe(false);
      expect(mockCookieStore.set).not.toHaveBeenCalled();
    });

    it('refreshes at exactly the 24-hour boundary', async () => {
      // Session expires in exactly 24 hours (at the boundary)
      const session = {
        sessionId: 'session-id',
        userId: 'user-id',
        token: 'boundary-token',
        expiresAt: new Date(Date.now() + REFRESH_THRESHOLD_MS),
        createdAt: new Date(),
      };

      // At exactly the threshold, timeUntilExpiry === REFRESH_THRESHOLD_MS
      // The condition is > (not >=), so at exactly 24h it should NOT refresh
      const result = await refreshSession(session);

      expect(result).toBe(false);
    });

    it('refreshes when 1ms past the 24-hour boundary', async () => {
      const session = {
        sessionId: 'session-id',
        userId: 'user-id',
        token: 'just-past-token',
        expiresAt: new Date(Date.now() + REFRESH_THRESHOLD_MS - 1),
        createdAt: new Date(),
      };

      mockSessionFindOneAndUpdate.mockResolvedValue({
        token: 'just-past-token',
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
      });

      const result = await refreshSession(session);

      expect(result).toBe(true);
    });
  });

  describe('invalidateSession', () => {
    it('deletes the session from the database and clears the cookie', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'active-token' });
      mockSessionDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await invalidateSession();

      expect(mockSessionDeleteOne).toHaveBeenCalledWith({ token: 'active-token' });
      expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
    });

    it('throws AuthError when no session cookie is present', async () => {
      mockCookieStore.get.mockReturnValue(undefined);

      await expect(invalidateSession()).rejects.toThrow('No active session to invalidate');
    });

    it('throws AuthError when session cookie has empty value', async () => {
      mockCookieStore.get.mockReturnValue({ value: '' });

      await expect(invalidateSession()).rejects.toThrow('No active session to invalidate');
    });
  });
});
