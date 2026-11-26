import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db/connection';
import Session, { ISession } from '@/lib/db/models/Session';

/**
 * Session cookie name — must match the value used in session.ts
 */
const COOKIE_NAME = 'session_token';

/** Default session duration: 7 days in seconds */
const SESSION_MAX_AGE_SECONDS = 604_800;

/** Refresh threshold: 24 hours in milliseconds */
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Default session duration: 7 days in milliseconds */
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

/**
 * Proxy function that intercepts protected routes, verifies the session cookie,
 * redirects to /auth/signin on failure, and passes user identity to request context
 * via x-user-id and x-user-email headers.
 *
 * When a session is within 24 hours of expiration, it is automatically refreshed.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without session verification
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Read the session cookie from the request
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;

  if (!sessionToken) {
    return unauthenticatedResponse(request);
  }

  // Verify the session against the database
  const session = await verifySessionToken(sessionToken);

  if (!session) {
    // Invalid or expired session — redirect to sign-in (or 401 for API routes)
    const response = unauthenticatedResponse(request);
    // Clear the invalid cookie
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Session is valid — forward user identity via request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.userId.toString());
  requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Check if session needs refresh (within 24h of expiration)
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
  if (timeUntilExpiry < REFRESH_THRESHOLD_MS) {
    await refreshSessionInDB(session.token);
    response.cookies.set(COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }

  return response;
}

/**
 * Determines if a pathname is a public route that doesn't require authentication.
 * Public routes include:
 * - The landing page (/)
 * - The sign-in page (/auth/signin)
 * - Static assets and Next.js internals
 */
function isPublicRoute(pathname: string): boolean {
  // Landing page
  if (pathname === '/') return true;

  // Auth routes (sign-in page)
  if (pathname.startsWith('/auth/')) return true;

  // API auth routes (signin/signout endpoints)
  if (pathname.startsWith('/api/auth/')) return true;

  // Note: /invite/* is intentionally NOT public. The invite page requires a
  // session, so unauthenticated visitors are redirected to sign-in with a
  // callbackUrl that brings them back to the invite after signing in.

  return false;
}

/**
 * Response for a request without a valid session.
 * API routes get a JSON 401 in the standard error format (clients calling
 * the API should never receive an HTML redirect); pages are redirected to
 * the sign-in page.
 */
function unauthenticatedResponse(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      { status: 401 }
    );
  }
  return redirectToSignIn(request);
}

/**
 * Creates a redirect response to the sign-in page.
 * Includes the current pathname as a callbackUrl so the user
 * is returned to their original destination after signing in.
 */
function redirectToSignIn(request: NextRequest): NextResponse {
  const signInUrl = new URL('/auth/signin', request.url);
  const { pathname } = request.nextUrl;
  if (pathname && pathname !== '/') {
    signInUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
  }
  return NextResponse.redirect(signInUrl, 302);
}

/**
 * Verifies a session token against the database.
 * Returns the session document if valid and not expired, null otherwise.
 */
async function verifySessionToken(token: string): Promise<ISession | null> {
  await connectDB();

  const session = await Session.findOne({
    token,
    expiresAt: { $gt: new Date() },
  }).lean<ISession>();

  return session ?? null;
}

/**
 * Refreshes a session in the database by extending its expiration.
 */
async function refreshSessionInDB(token: string): Promise<void> {
  await connectDB();

  const newExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await Session.findOneAndUpdate(
    { token, expiresAt: { $gt: new Date() } },
    { expiresAt: newExpiresAt }
  );
}

/**
 * Matcher configuration — proxy runs on all routes except static assets
 * and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Public folder assets (images, svgs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.svg$|.*\\.png$|.*\\.ico$).*)',
  ],
};
