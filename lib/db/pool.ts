import "server-only";

import { Pool } from "pg";

const globalForDb = globalThis as unknown as { confiaDbPool?: Pool };

export function getDbPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Falta DATABASE_URL en el entorno del servidor.");

  if (!globalForDb.confiaDbPool) {
    globalForDb.confiaDbPool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return globalForDb.confiaDbPool;
}
