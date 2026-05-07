import { NextRequest } from 'next/server';

/**
 * Extracts the client IP address from a request.
 *
 * Checks X-Forwarded-For (first entry) and X-Real-IP headers,
 * which are typically set by reverse proxies like nginx.
 *
 * @returns The client IP string, or undefined if not available
 */
export function getClientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}

/**
 * Safely parses the JSON body of a request.
 *
 * @returns The parsed body, or null if the body is not valid JSON
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest
): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
