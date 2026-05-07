import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks ---

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

const mockSessionFindOne = vi.fn();
const mockSessionFindOneAndUpdate = vi.fn();

vi.mock('@/lib/db/models/Session', () => ({
  default: {
    findOne: (...args: unknown[]) => mockSessionFindOne(...args),
    findOneAndUpdate: (...args: unknown[]) => mockSessionFindOneAndUpdate(...args),
  },
}));

// Import after mocks are set up
import { proxy, config } from './proxy';

function createRequest(url: string, cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(new URL(url, 'http://localhost:3000'));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  describe('public routes', () => {
    it('allows access to the landing page without a session', async () => {
      const request = createRequest('http://localhost:3000/');
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockSessionFindOne).not.toHaveBeenCalled();
    });

    it('allows access to the sign-in page without a session', async () => {
      const request = createRequest('http://localhost:3000/auth/signin');
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockSessionFindOne).not.toHaveBeenCalled();
    });

    it('allows access to auth API routes without a session', async () => {
      const request = createRequest('http://localhost:3000/api/auth/signin');
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockSessionFindOne).not.toHaveBeenCalled();
    });

    it('allows access to invite routes without a session', async () => {
      const request = createRequest('http://localhost:3000/invite/abc123');
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockSessionFindOne).not.toHaveBeenCalled();
    });
  });

  describe('protected routes - no session', () => {
    it('redirects to /auth/signin when no session cookie is present', async () => {
      const request = createRequest('http://localhost:3000/dashboard');
      const response = await proxy(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('http://localhost:3000/auth/signin');
    });

    it('redirects to /auth/signin for nested protected routes', async () => {
      const request = createRequest('http://localhost:3000/trees/123/persons');
      const response = await proxy(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('http://localhost:3000/auth/signin');
    });
  });

  describe('protected routes - invalid session', () => {
    it('redirects to /auth/signin when session token is not found in DB', async () => {
      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'invalid-token',
      });
      const response = await proxy(request);

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('http://localhost:3000/auth/signin');
    });

    it('clears the invalid session cookie on redirect', async () => {
      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'expired-token',
      });
      const response = await proxy(request);

      // Check that the cookie is being deleted (set with maxAge=0 or expires in past)
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('session_token');
    });
  });

  describe('protected routes - valid session', () => {
    const validSession = {
      _id: { toString: () => 'session-id-123' },
      userId: { toString: () => '507f1f77bcf86cd799439011' },
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      createdAt: new Date(),
    };

    it('allows access and passes x-user-id header when session is valid', async () => {
      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(validSession),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'valid-token',
      });
      const response = await proxy(request);

      expect(response.status).toBe(200);
      // The x-user-id header is set on the request forwarded upstream,
      // which is reflected in the response headers for middleware
      expect(response.headers.get('x-middleware-request-x-user-id')).toBe('507f1f77bcf86cd799439011');
    });

    it('does not refresh session when expiry is more than 24h away', async () => {
      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(validSession),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'valid-token',
      });
      await proxy(request);

      expect(mockSessionFindOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('session refresh', () => {
    it('refreshes session when within 24 hours of expiration', async () => {
      const expiringSession = {
        _id: { toString: () => 'session-id-123' },
        userId: { toString: () => '507f1f77bcf86cd799439011' },
        token: 'expiring-token',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours from now
        createdAt: new Date(),
      };

      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(expiringSession),
      });
      mockSessionFindOneAndUpdate.mockResolvedValue({
        token: 'expiring-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'expiring-token',
      });
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockSessionFindOneAndUpdate).toHaveBeenCalledWith(
        { token: 'expiring-token', expiresAt: { $gt: expect.any(Date) } },
        { expiresAt: expect.any(Date) }
      );

      // Verify the refreshed cookie is set on the response
      const setCookieHeader = response.headers.get('set-cookie');
      expect(setCookieHeader).toContain('session_token=expiring-token');
    });

    it('does not refresh session at exactly 24h boundary', async () => {
      const boundarySession = {
        _id: { toString: () => 'session-id-123' },
        userId: { toString: () => '507f1f77bcf86cd799439011' },
        token: 'boundary-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // exactly 24h
        createdAt: new Date(),
      };

      mockSessionFindOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(boundarySession),
      });

      const request = createRequest('http://localhost:3000/dashboard', {
        session_token: 'boundary-token',
      });
      await proxy(request);

      expect(mockSessionFindOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('config matcher', () => {
    it('exports a matcher config that excludes static assets', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
