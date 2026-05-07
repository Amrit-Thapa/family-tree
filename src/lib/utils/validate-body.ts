import { NextRequest } from 'next/server';
import { ZodType } from 'zod';
import { ValidationError } from '@/lib/utils/errors';
import { parseJsonBody } from '@/lib/utils/request';

/**
 * Parses the request body as JSON and validates it against a Zod schema.
 *
 * Throws:
 * - ValidationError with code INVALID_JSON if the body is not valid JSON
 * - ValidationError with code INVALID_INPUT if validation fails (reports first issue)
 *
 * @param request - The incoming Next.js request
 * @param schema - A Zod schema to validate against
 * @returns The validated and typed data
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<T> {
  const body = await parseJsonBody(request);

  if (!body) {
    throw new ValidationError('Request body must be valid JSON', 'INVALID_JSON');
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new ValidationError(
      firstIssue.message,
      'INVALID_INPUT',
      { field: firstIssue.path.join('.') }
    );
  }

  return parsed.data;
}
