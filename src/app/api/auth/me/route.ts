import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/services/auth.service';
import { AuthError } from '@/lib/utils/errors';
import { apiHandler } from '@/lib/utils/api-handler';

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile by verifying
 * the session cookie and fetching the user record from the database.
 *
 * Request: No body required. Session cookie must be present.
 * Success response: 200 { user: { id, email, displayName, photoURL?, createdAt, notificationPreferences } }
 * Error responses: 401 (no valid session), 500 (unexpected)
 */
export const GET = apiHandler(async (_request: NextRequest) => {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError('Not authenticated', 'NOT_AUTHENTICATED');
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: user.createdAt,
      notificationPreferences: user.notificationPreferences,
    },
  }, { status: 200 });
});
