import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockSignIn = vi.fn();

vi.mock('@/lib/services/auth.service', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// --- Helpers ---

function createRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/auth/signin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return req;
}

describe('POST /api/auth/signin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with user data on successful sign-in', async () => {
    const mockUser = {
      id: 'user-id-123',
      firebaseUid: 'firebase-uid-123',
      email: 'user@example.com',
      displayName: 'Test User',
      photoURL: 'https://example.com/photo.jpg',
    };

    mockSignIn.mockResolvedValue({
      user: mockUser,
      sessionToken: 'session-token-abc',
    });

    const request = createRequest(
      { idToken: 'valid-firebase-id-token' },
      { 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '192.168.1.1' }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual(mockUser);
    expect(mockSignIn).toHaveBeenCalledWith('valid-firebase-id-token', {
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
    });
  });

  it('passes x-real-ip when x-forwarded-for is not present', async () => {
    mockSignIn.mockResolvedValue({
      user: { id: 'user-id', firebaseUid: 'uid', email: 'a@b.com', displayName: 'A' },
      sessionToken: 'token',
    });

    const request = createRequest(
      { idToken: 'valid-token' },
      { 'x-real-ip': '10.0.0.1' }
    );

    await POST(request);

    expect(mockSignIn).toHaveBeenCalledWith('valid-token', {
      userAgent: undefined,
      ipAddress: '10.0.0.1',
    });
  });

  it('returns 400 when idToken is missing', async () => {
    const request = createRequest({});

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('returns 400 when idToken is empty string', async () => {
    const request = createRequest({ idToken: '' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_INPUT');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('returns 401 when Firebase token is invalid (AuthError from service)', async () => {
    const { AuthError } = await import('@/lib/utils/errors');
    mockSignIn.mockRejectedValue(
      new AuthError('Invalid or expired Firebase ID token', 'INVALID_ID_TOKEN')
    );

    const request = createRequest({ idToken: 'invalid-token' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('INVALID_ID_TOKEN');
    expect(data.error.message).toBe('Invalid or expired Firebase ID token');
  });

  it('returns 500 on unexpected errors', async () => {
    mockSignIn.mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest({ idToken: 'some-token' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('An unexpected error occurred');
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_JSON');
    expect(data.error.message).toBe('Request body must be valid JSON');
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
