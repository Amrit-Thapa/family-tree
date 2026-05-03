import mongoose from 'mongoose';

/**
 * MongoDB connection singleton using Mongoose.
 *
 * In Next.js, module-level variables are preserved across hot reloads in
 * development but each serverless invocation in production gets a fresh
 * module scope. We cache the connection promise on `globalThis` so that:
 *
 * 1. In development, hot reloads reuse the existing connection instead of
 *    opening a new one every time a file changes.
 * 2. In production (single-process Docker deployment), the module-level
 *    cache works naturally. If the app ever moves to a serverless host,
 *    the `globalThis` cache still prevents duplicate connections within
 *    the same warm container.
 */

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'MONGODB_URI environment variable is not defined. ' +
    'Add it to .env.local or your environment configuration.'
  );
}

/**
 * Cached connection state stored on globalThis to survive Next.js hot
 * reloads in development.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Extend globalThis so TypeScript is happy with the cache property.
declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

function getCache(): MongooseCache {
  if (!globalThis.__mongooseCache) {
    globalThis.__mongooseCache = { conn: null, promise: null };
  }
  return globalThis.__mongooseCache;
}

/**
 * Returns a connected Mongoose instance. Reuses an existing connection
 * when one is already established or in progress.
 *
 * Usage:
 * ```ts
 * import { connectDB } from '@/lib/db/connection';
 *
 * const mongoose = await connectDB();
 * ```
 */
export async function connectDB(): Promise<typeof mongoose> {
  const cache = getCache();

  // Already connected — return immediately.
  if (cache.conn) {
    return cache.conn;
  }

  // Connection in progress — wait for it.
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI as string, {
        bufferCommands: false, // Fail fast if not connected rather than buffering
      })
      .then((m) => {
        return m;
      });
  }

  try {
    cache.conn = await cache.promise;
  } catch (err) {
    // Reset the promise so the next call retries instead of returning
    // the same rejected promise forever.
    cache.promise = null;
    throw err;
  }

  return cache.conn;
}
