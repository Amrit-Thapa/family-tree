import { verifySession, SessionData } from '@/lib/auth/session';
import { AuthError } from '@/lib/utils/errors';

/**
 * Verifies the current session and returns the session data.
 * Throws AuthError if no valid session exists.
 *
 * Use this in any protected route handler to enforce authentication
 * without repeating the null-check boilerplate.
 */
export async function requireSession(): Promise<SessionData> {
  const session = await verifySession();

  if (!session) {
    throw new AuthError('Not authenticated', 'NOT_AUTHENTICATED');
  }

  return session;
}
