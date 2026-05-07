import { NextRequest } from 'next/server';
import { signOut } from '@/lib/services/auth.service';
import { apiHandler } from '@/lib/utils/api-handler';

/**
 * POST /api/auth/signout
 *
 * Invalidates the current server-side session and clears the session cookie.
 * The client is responsible for redirecting to the sign-in page after a
 * successful response.
 *
 * Request body: none
 * Success response: 200 { message: "Signed out successfully" }
 * Error responses: 401 (no active session), 500 (unexpected)
 */
export const POST = apiHandler(async (_request: NextRequest) => {
  await signOut();

  return Response.json({ message: 'Signed out successfully' }, { status: 200 });
});
