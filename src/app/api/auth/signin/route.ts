import { NextRequest } from 'next/server';
import { signIn } from '@/lib/services/auth.service';
import { apiHandler } from '@/lib/utils/api-handler';
import { getClientIp } from '@/lib/utils/request';
import { validateBody } from '@/lib/utils/validate-body';
import { signInBodySchema } from '@/lib/validations/auth';

/**
 * POST /api/auth/signin
 *
 * Accepts a Firebase ID token, verifies it, finds or creates the user,
 * creates a server-side session, and sets an HttpOnly session cookie.
 *
 * Request body: { idToken: string }
 * Success response: 200 { user: { id, firebaseUid, email, displayName, photoURL? } }
 * Error responses: 400 (invalid JSON/missing token), 401 (invalid token), 500 (unexpected)
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { idToken } = await validateBody(request, signInBodySchema);
  const userAgent = request.headers.get('user-agent') || undefined;
  const ipAddress = getClientIp(request);

  const result = await signIn(idToken, { userAgent, ipAddress });

  return Response.json({ user: result.user }, { status: 200 });
});
