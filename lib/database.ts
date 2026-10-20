import "server-only";
import { Pool } from "pg";

declare global {
  var applicationDatabasePool: Pool | undefined;
}

export function getDatabasePool() {
  if (globalThis.applicationDatabasePool) return globalThis.applicationDatabasePool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for application database access.");
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  globalThis.applicationDatabasePool = pool;
  return pool;
}
