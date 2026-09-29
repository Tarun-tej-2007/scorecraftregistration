import mongoose from "mongoose";

// ─────────────────────────────────────────────────────────
// MongoDB connection with connection pooling.
// MONGODB_URI is validated lazily inside connectDB() so
// Next.js can build without the env var present —
// it will fail with a clear message at runtime if missing.
// ─────────────────────────────────────────────────────────

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not defined. " +
      "Add it to .env.local: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/scorecraft"
    );
  }

  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { bufferCommands: false });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
