import mongoose from 'mongoose';

// --- Type guard ---

interface MongoError extends Error {
  codeName?: string;
  code?: number;
}

function isMongoError(err: unknown): err is MongoError {
  return err instanceof Error;
}

// --- Transaction support cache ---

/** Cached result of transaction support probe. `null` means not yet determined. */
let transactionsSupported: boolean | null = null;

/**
 * Attempts to run a callback within a MongoDB transaction.
 * Falls back to running without a transaction if the deployment
 * does not support them (e.g., standalone MongoDB without replica set).
 *
 * Once a transaction failure is detected, subsequent calls skip the
 * transaction attempt entirely to avoid repeated session overhead.
 *
 * @param fn - The callback to run, receives a session (or null if transactions are unsupported)
 * @returns The result of the callback
 */
export async function withOptionalTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>
): Promise<T> {
  if (transactionsSupported === false) {
    return fn(null);
  }

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    transactionsSupported = true;
    return result;
  } catch (error: unknown) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    // If transactions aren't supported, cache the result and retry without one
    if (isMongoError(error) && isTransactionUnsupportedError(error)) {
      transactionsSupported = false;
      return fn(null);
    }
    throw error;
  } finally {
    session?.endSession();
  }
}

/**
 * Determines whether an error indicates that the MongoDB deployment
 * does not support transactions (standalone, no replica set, etc.).
 */
function isTransactionUnsupportedError(error: MongoError): boolean {
  return (
    error.codeName === 'IllegalOperation' ||
    error.message.includes('Transaction') ||
    error.message.includes('transaction')
  );
}

/**
 * Resets the cached transaction support state.
 * Useful in tests to ensure a clean slate between test runs.
 */
export function resetTransactionCache(): void {
  transactionsSupported = null;
}
