import { cookies } from 'next/headers';
import crypto from 'crypto';
import { connectDB } from '@/lib/db/connection';
import Session, { ISession } from '@/lib/db/models/Session';
import { AuthError } from '@/lib/utils/errors';

/**
 * Session management for the Family Relationship Intelligence Platform.
 *
 * Handles creation, verification, refresh, and invalidation of
 * server-side sessions backed by MongoDB with HttpOnly cookie transport.
 */

// --- Constants ---

const COOKIE_NAME = 'session_token';

/** Default session duration: 7 days in seconds */
const SESSION_MAX_AGE_SECONDS = 604800;

/** Default session duration: 7 days in milliseconds */
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

/** Refresh threshold: 24 hours in milliseconds */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// --- Types ---

export interface CreateSessionOptions {
  userAgent?: string;
  ipAddress?: string;
  /** Session duration in seconds. Defaults to 604800 (7 days). */
  maxAge?: number;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

// --- Cookie helpers ---

function getSessionCookieOptions(maxAge: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

// --- Public API ---

/**
 * Creates a new session for the given user.
 *
 * Generates a cryptographically random token, stores the session in MongoDB,
 * and sets an HttpOnly cookie on the response.
 *
 * Must be called from a Server Action or Route Handler (contexts where
 * cookies can be written).
 */
export async function createSession(
  userId: string,
  options: CreateSessionOptions = {}
): Promise<SessionData> {
  await connectDB();

  const token = crypto.randomUUID();
  const maxAgeSeconds = options.maxAge ?? SESSION_MAX_AGE_SECONDS;
  const maxAgeMs = maxAgeSeconds * 1000;
  const expiresAt = new Date(Date.now() + maxAgeMs);

  const session = await Session.create({
    userId,
    token,
    expiresAt,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
  });

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getSessionCookieOptions(maxAgeSeconds));

  return {
    sessionId: session._id.toString(),
    userId: session.userId.toString(),
    token: session.token,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
  };
}

/**
 * Verifies the current session by reading the session_token cookie
 * and validating it against the database.
 *
 * Returns the session data if valid, or null if the session is
 * missing, expired, or not found in the database.
 */
export async function verifySession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  await connectDB();

  const session = await Session.findOne({
    token: sessionCookie.value,
    expiresAt: { $gt: new Date() },
  }).lean<ISession>();

  if (!session) {
    return null;
  }

  return {
    sessionId: session._id.toString(),
    userId: session.userId.toString(),
    token: session.token,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
  };
}

/**
 * Refreshes a session if it is within 24 hours of expiration.
 *
 * Extends the session expiry by the full session duration (7 days)
 * and updates the cookie with the new max-age.
 *
 * Must be called from a Server Action or Route Handler.
 *
 * @returns true if the session was refreshed, false if not within threshold
 */
export async function refreshSession(
  session: SessionData
): Promise<boolean> {
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();

  // Only refresh if within 24 hours of expiration
  if (timeUntilExpiry > REFRESH_THRESHOLD_MS) {
    return false;
  }

  await connectDB();

  const newExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const updated = await Session.findOneAndUpdate(
    { token: session.token, expiresAt: { $gt: new Date() } },
    { expiresAt: newExpiresAt },
    { new: true }
  );

  if (!updated) {
    return false;
  }

  // Update the cookie with the new max-age
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session.token, getSessionCookieOptions(SESSION_MAX_AGE_SECONDS));

  return true;
}

/**
 * Invalidates the current session by deleting it from the database
 * and clearing the session cookie.
 *
 * Must be called from a Server Action or Route Handler.
 *
 * @throws AuthError if no session cookie is present
 */
export async function invalidateSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    throw new AuthError('No active session to invalidate', 'SESSION_NOT_FOUND');
  }

  await connectDB();

  // Delete the session from the database
  await Session.deleteOne({ token: sessionCookie.value });

  // Clear the cookie by deleting it
  cookieStore.delete(COOKIE_NAME);
}

// --- Exports for testing and reuse ---

export { COOKIE_NAME, SESSION_MAX_AGE_SECONDS, SESSION_MAX_AGE_MS, REFRESH_THRESHOLD_MS };
