/**
 * Custom error classes for the Family Relationship Intelligence Platform.
 *
 * Provides a standardized API error response format:
 * {
 *   error: {
 *     code: string;       // Machine-readable: 'TREE_LIMIT_REACHED', 'INVALID_INPUT'
 *     message: string;    // Human-readable
 *     field?: string;     // For validation errors
 *     details?: unknown;  // Additional context
 *   }
 * }
 */

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    field?: string;
    details?: unknown;
  };
}

/**
 * Base application error class. All custom errors extend this.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly field?: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    options?: { field?: string; details?: unknown; isOperational?: boolean }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.field = options?.field;
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts this error into the standardized API error response format.
   */
  toApiResponse(): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field && { field: this.field }),
        ...(this.details !== undefined && { details: this.details }),
      },
    };
  }
}

/**
 * 400 - Validation errors and business rule violations.
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    code: string = 'INVALID_INPUT',
    options?: { field?: string; details?: unknown }
  ) {
    super(message, 400, code, options);
  }
}

/**
 * 401 - Not authenticated.
 */
export class AuthError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: string = 'NOT_AUTHENTICATED',
    options?: { details?: unknown }
  ) {
    super(message, 401, code, options);
  }
}

/**
 * 403 - Not authorized (insufficient role).
 */
export class ForbiddenError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    code: string = 'FORBIDDEN',
    options?: { details?: unknown }
  ) {
    super(message, 403, code, options);
  }
}

/**
 * 404 - Entity not found (or no access — don't leak existence).
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: string = 'NOT_FOUND',
    options?: { details?: unknown }
  ) {
    super(message, 404, code, options);
  }
}

/**
 * 409 - Conflict (duplicate relationship, already claimed).
 */
export class ConflictError extends AppError {
  constructor(
    message: string,
    code: string = 'CONFLICT',
    options?: { field?: string; details?: unknown }
  ) {
    super(message, 409, code, options);
  }
}

/**
 * 429 - Rate limited.
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests. Please try again later.',
    code: string = 'RATE_LIMITED',
    options?: { details?: unknown }
  ) {
    super(message, 429, code, options);
  }
}

/**
 * Converts an error into the standardized API error response.
 * Handles both AppError instances and unexpected errors.
 *
 * For unexpected errors, returns a generic 500 response to avoid
 * leaking internal details to the client.
 */
export function toApiErrorResponse(error: unknown): {
  body: ApiErrorResponse;
  status: number;
} {
  if (error instanceof AppError) {
    return {
      body: error.toApiResponse(),
      status: error.statusCode,
    };
  }

  // Unexpected error — don't leak internals to the client
  return {
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    status: 500,
  };
}

/**
 * Type guard to check if an error is an operational AppError.
 * Operational errors are expected (validation, auth, etc.) and safe to expose.
 * Non-operational errors are bugs that need investigation.
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}
