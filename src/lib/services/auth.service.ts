import { adminAuth } from '@/lib/auth/firebase-admin';
import { createSession, verifySession, invalidateSession } from '@/lib/auth/session';
import { connectDB } from '@/lib/db/connection';
import User, { IUser } from '@/lib/db/models/User';
import { AuthError, ValidationError } from '@/lib/utils/errors';

/**
 * Authentication service for the Family Relationship Intelligence Platform.
 *
 * Handles sign-in (Firebase ID token verification + find-or-create User + session creation),
 * sign-out (session invalidation), and getCurrentUser (session-based user retrieval).
 */

// --- Types ---

export interface SignInOptions {
  userAgent?: string;
  ipAddress?: string;
}

export interface SignInResult {
  user: {
    id: string;
    firebaseUid: string;
    email: string;
    displayName: string;
    photoURL?: string;
  };
  sessionToken: string;
}

export interface CurrentUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  notificationPreferences: IUser['notificationPreferences'];
}

// --- Public API ---

/**
 * Signs in a user by verifying a Firebase ID token, finding or creating
 * the User record in MongoDB, and creating a server-side session.
 *
 * Flow:
 * 1. Verify the Firebase ID token using Firebase Admin SDK
 * 2. Find existing User by firebaseUid, or create a new one
 * 3. Update lastLoginAt timestamp
 * 4. Create a session (sets HttpOnly cookie)
 *
 * @param idToken - The Firebase ID token from the client
 * @param options - Optional metadata (userAgent, ipAddress)
 * @returns The authenticated user info and session token
 * @throws ValidationError if idToken is missing
 * @throws AuthError if token verification fails
 */
export async function signIn(
  idToken: string,
  options: SignInOptions = {}
): Promise<SignInResult> {
  if (!idToken || !idToken.trim()) {
    throw new ValidationError('Firebase ID token is required', 'MISSING_ID_TOKEN');
  }

  // Step 1: Verify the Firebase ID token
  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    throw new AuthError(
      'Invalid or expired Firebase ID token',
      'INVALID_ID_TOKEN',
      { details: error instanceof Error ? error.message : 'Token verification failed' }
    );
  }

  const { uid, email, name, picture } = decodedToken;

  if (!email) {
    throw new AuthError(
      'Firebase token does not contain an email address',
      'MISSING_EMAIL'
    );
  }

  // Step 2: Find or create User in MongoDB
  await connectDB();

  let user = await User.findOne({ firebaseUid: uid });

  if (!user) {
    // Create new user from Firebase profile
    user = await User.create({
      firebaseUid: uid,
      email,
      displayName: name || email.split('@')[0],
      photoURL: picture || undefined,
      lastLoginAt: new Date(),
    });
  } else {
    // Update last login timestamp for existing user
    user.lastLoginAt = new Date();
    await user.save();
  }

  // Step 3: Create a session
  const session = await createSession(user._id.toString(), {
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
  });

  return {
    user: {
      id: user._id.toString(),
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    },
    sessionToken: session.token,
  };
}

/**
 * Signs out the current user by invalidating their session.
 *
 * Delegates to the session module which deletes the session from MongoDB
 * and clears the HttpOnly cookie.
 *
 * @throws AuthError if no active session exists
 */
export async function signOut(): Promise<void> {
  await invalidateSession();
}

/**
 * Gets the currently authenticated user from the session.
 *
 * Verifies the session cookie, then fetches the full User record
 * from MongoDB.
 *
 * @returns The current user's profile, or null if not authenticated
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await verifySession();

  if (!session) {
    return null;
  }

  await connectDB();

  const user = await User.findById(session.userId).lean<IUser>();

  if (!user || user.deletedAt) {
    return null;
  }

  return {
    id: user._id.toString(),
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    notificationPreferences: user.notificationPreferences,
  };
}
