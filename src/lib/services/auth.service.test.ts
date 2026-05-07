import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, signOut, getCurrentUser } from './auth.service';

// --- Mocks ---

const mockVerifyIdToken = vi.fn();

vi.mock('@/lib/auth/firebase-admin', () => ({
  adminAuth: {
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  },
}));

const mockCreateSession = vi.fn();
const mockVerifySession = vi.fn();
const mockInvalidateSession = vi.fn();

vi.mock('@/lib/auth/session', () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
  invalidateSession: (...args: unknown[]) => mockInvalidateSession(...args),
}));

vi.mock('@/lib/db/connection', () => ({
  connectDB: vi.fn(async () => { }),
}));

const mockUserFindOne = vi.fn();
const mockUserCreate = vi.fn();
const mockUserFindById = vi.fn();

vi.mock('@/lib/db/models/User', () => ({
  default: {
    findOne: (...args: unknown[]) => mockUserFindOne(...args),
    create: (...args: unknown[]) => mockUserCreate(...args),
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
}));

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signIn', () => {
    const validDecodedToken = {
      uid: 'firebase-uid-123',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/photo.jpg',
    };

    it('verifies the Firebase ID token and creates a new user when none exists', async () => {
      mockVerifyIdToken.mockResolvedValue(validDecodedToken);
      mockUserFindOne.mockResolvedValue(null);

      const createdUser = {
        _id: { toString: () => 'user-id-456' },
        firebaseUid: 'firebase-uid-123',
        email: 'user@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
      };
      mockUserCreate.mockResolvedValue(createdUser);

      mockCreateSession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'user-id-456',
        token: 'session-token-abc',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await signIn('valid-id-token', {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });

      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-id-token');
      expect(mockUserFindOne).toHaveBeenCalledWith({ firebaseUid: 'firebase-uid-123' });
      expect(mockUserCreate).toHaveBeenCalledWith({
        firebaseUid: 'firebase-uid-123',
        email: 'user@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        lastLoginAt: expect.any(Date),
      });
      expect(mockCreateSession).toHaveBeenCalledWith('user-id-456', {
        userAgent: 'Mozilla/5.0',
        ipAddress: '127.0.0.1',
      });
      expect(result.user.id).toBe('user-id-456');
      expect(result.user.email).toBe('user@example.com');
      expect(result.sessionToken).toBe('session-token-abc');
    });

    it('finds an existing user and updates lastLoginAt', async () => {
      mockVerifyIdToken.mockResolvedValue(validDecodedToken);

      const existingUser = {
        _id: { toString: () => 'existing-user-id' },
        firebaseUid: 'firebase-uid-123',
        email: 'user@example.com',
        displayName: 'Test User',
        photoURL: 'https://example.com/photo.jpg',
        lastLoginAt: null,
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockUserFindOne.mockResolvedValue(existingUser);

      mockCreateSession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'existing-user-id',
        token: 'session-token-xyz',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const result = await signIn('valid-id-token');

      expect(mockUserCreate).not.toHaveBeenCalled();
      expect(existingUser.save).toHaveBeenCalled();
      expect(existingUser.lastLoginAt).toBeInstanceOf(Date);
      expect(result.user.id).toBe('existing-user-id');
      expect(result.sessionToken).toBe('session-token-xyz');
    });

    it('throws ValidationError when idToken is empty', async () => {
      await expect(signIn('')).rejects.toThrow('Firebase ID token is required');
      await expect(signIn('   ')).rejects.toThrow('Firebase ID token is required');
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it('throws AuthError when Firebase token verification fails', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

      await expect(signIn('invalid-token')).rejects.toThrow(
        'Invalid or expired Firebase ID token'
      );
    });

    it('throws AuthError when token has no email', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'uid-no-email',
        email: undefined,
        name: 'No Email User',
      });

      await expect(signIn('token-no-email')).rejects.toThrow(
        'Firebase token does not contain an email address'
      );
    });

    it('uses email prefix as displayName when name is not provided', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: 'uid-no-name',
        email: 'noname@example.com',
        name: undefined,
        picture: undefined,
      });
      mockUserFindOne.mockResolvedValue(null);

      const createdUser = {
        _id: { toString: () => 'new-user-id' },
        firebaseUid: 'uid-no-name',
        email: 'noname@example.com',
        displayName: 'noname',
        photoURL: undefined,
      };
      mockUserCreate.mockResolvedValue(createdUser);

      mockCreateSession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'new-user-id',
        token: 'token-123',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await signIn('token-no-name');

      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'noname',
          photoURL: undefined,
        })
      );
    });
  });

  describe('signOut', () => {
    it('delegates to invalidateSession', async () => {
      mockInvalidateSession.mockResolvedValue(undefined);

      await signOut();

      expect(mockInvalidateSession).toHaveBeenCalled();
    });

    it('propagates AuthError from invalidateSession', async () => {
      mockInvalidateSession.mockRejectedValue(
        new Error('No active session to invalidate')
      );

      await expect(signOut()).rejects.toThrow('No active session to invalidate');
    });
  });

  describe('getCurrentUser', () => {
    it('returns the current user when session is valid', async () => {
      mockVerifySession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'user-id-789',
        token: 'valid-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      const userDoc = {
        _id: { toString: () => 'user-id-789' },
        firebaseUid: 'firebase-uid-789',
        email: 'current@example.com',
        displayName: 'Current User',
        photoURL: 'https://example.com/avatar.jpg',
        lastLoginAt: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        deletedAt: null,
        notificationPreferences: {
          invites: true,
          claims: true,
          membershipChanges: true,
          treeUpdates: true,
          crossTreeEdits: true,
        },
      };

      mockUserFindById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(userDoc),
      });

      const result = await getCurrentUser();

      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-id-789');
      expect(result!.email).toBe('current@example.com');
      expect(result!.displayName).toBe('Current User');
      expect(result!.notificationPreferences.invites).toBe(true);
    });

    it('returns null when no session exists', async () => {
      mockVerifySession.mockResolvedValue(null);

      const result = await getCurrentUser();

      expect(result).toBeNull();
      expect(mockUserFindById).not.toHaveBeenCalled();
    });

    it('returns null when user is soft-deleted', async () => {
      mockVerifySession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'deleted-user-id',
        token: 'token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      mockUserFindById.mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: { toString: () => 'deleted-user-id' },
          firebaseUid: 'uid',
          email: 'deleted@example.com',
          displayName: 'Deleted User',
          deletedAt: new Date('2024-01-10'),
          notificationPreferences: {},
        }),
      });

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    it('returns null when user is not found in database', async () => {
      mockVerifySession.mockResolvedValue({
        sessionId: 'session-id',
        userId: 'nonexistent-user-id',
        token: 'token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      mockUserFindById.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      });

      const result = await getCurrentUser();

      expect(result).toBeNull();
    });
  });
});
