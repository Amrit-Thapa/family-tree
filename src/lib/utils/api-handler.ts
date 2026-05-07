import { NextRequest } from 'next/server';
import { toApiErrorResponse } from '@/lib/utils/errors';

/**
 * Wraps a route handler function with standardized error handling.
 *
 * Catches any thrown error, converts it to the standard API error response
 * format, and returns the appropriate HTTP status. This keeps route handlers
 * focused on the happy path.
 *
 * Usage:
 * ```ts
 * export const POST = apiHandler(async (request) => {
 *   // ... happy path logic
 *   return Response.json({ data }, { status: 200 });
 * });
 * ```
 */
export function apiHandler(fn: (request: NextRequest) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      return await fn(request);
    } catch (error: unknown) {
      const { body, status } = toApiErrorResponse(error);
      return Response.json(body, { status });
    }
  };
}

/**
 * Wraps a route handler function that receives dynamic route params
 * with standardized error handling.
 *
 * Usage:
 * ```ts
 * export const GET = apiHandlerWithParams(async (request, { params }) => {
 *   const { treeId } = await params;
 *   // ... happy path logic
 *   return Response.json({ data }, { status: 200 });
 * });
 * ```
 */
export function apiHandlerWithParams<T extends Record<string, string>>(
  fn: (
    request: NextRequest,
    context: { params: Promise<T> }
  ) => Promise<Response>
) {
  return async (
    request: NextRequest,
    context: { params: Promise<T> }
  ): Promise<Response> => {
    try {
      return await fn(request, context);
    } catch (error: unknown) {
      const { body, status } = toApiErrorResponse(error);
      return Response.json(body, { status });
    }
  };
}
