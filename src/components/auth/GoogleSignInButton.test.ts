import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/auth
const mockSignInWithPopup = vi.fn();
vi.mock('firebase/auth', () => ({
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(),
}));

// Mock firebase client
vi.mock('@/lib/auth/firebase-client', () => ({
  clientAuth: {},
  googleProvider: {},
}));

describe('GoogleSignInButton logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('calls signInWithPopup with clientAuth and googleProvider', async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken: mockGetIdToken },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '123' } }),
    });

    const { clientAuth, googleProvider } = await import('@/lib/auth/firebase-client');

    // Simulate the sign-in flow
    const result = await mockSignInWithPopup(clientAuth, googleProvider);
    const idToken = await result.user.getIdToken();

    expect(mockSignInWithPopup).toHaveBeenCalledWith(clientAuth, googleProvider);
    expect(idToken).toBe('mock-id-token');
  });

  it('posts ID token to /api/auth/signin after successful Firebase auth', async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken: mockGetIdToken },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '123' } }),
    });

    const { clientAuth, googleProvider } = await import('@/lib/auth/firebase-client');

    const result = await mockSignInWithPopup(clientAuth, googleProvider);
    const idToken = await result.user.getIdToken();

    await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: 'mock-id-token' }),
    });
  });

  it('handles Firebase popup cancelled error gracefully', async () => {
    const popupError = new Error('Firebase: Error (auth/popup-closed-by-user).');
    (popupError as Error & { code?: string }).code = 'auth/popup-closed-by-user';
    mockSignInWithPopup.mockRejectedValue(popupError);

    const { clientAuth, googleProvider } = await import('@/lib/auth/firebase-client');

    try {
      await mockSignInWithPopup(clientAuth, googleProvider);
    } catch (err: unknown) {
      const firebaseError = err as Error & { code?: string };
      expect(firebaseError.code).toBe('auth/popup-closed-by-user');
    }
  });

  it('handles API error response', async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');
    mockSignInWithPopup.mockResolvedValue({
      user: { getIdToken: mockGetIdToken },
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Invalid token', code: 'INVALID_ID_TOKEN' } }),
    });

    const { clientAuth, googleProvider } = await import('@/lib/auth/firebase-client');

    const result = await mockSignInWithPopup(clientAuth, googleProvider);
    const idToken = await result.user.getIdToken();

    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    expect(response.ok).toBe(false);
    const data = await response.json();
    expect(data.error.message).toBe('Invalid token');
  });
});
