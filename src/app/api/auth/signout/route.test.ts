import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// --- Mocks ---

const mockSignOut = vi.fn();

vi.mock('@/lib/services/auth.service', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// --- Helpers ---

function createRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/signout', {
    method: 'POST',
  });
}

describe('POST /api/auth/signout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with success message on successful sign-out', async () => {
    mockSignOut.mockResolvedValue(undefined);

    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Signed out successfully');
    expect(mockSignOut).toHaveBeenCalledOnce();
  });

  it('returns 401 when no active session exists', async () => {
    const { AuthError } = await import('@/lib/utils/errors');
    mockSignOut.mockRejectedValue(
      new AuthError('No active session to invalidate', 'SESSION_NOT_FOUND')
    );

    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('SESSION_NOT_FOUND');
    expect(data.error.message).toBe('No active session to invalidate');
  });

  it('returns 500 on unexpected errors', async () => {
    mockSignOut.mockRejectedValue(new Error('Database connection failed'));

    const request = createRequest();
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toBe('An unexpected error occurred');
  });
});
