import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

// Always prefer NEON_DATABASE_URL (the ITEX production database — source of truth).
// Fall back to DATABASE_URL (Replit Helium) only if NEON_DATABASE_URL is absent.
const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Public Neon URLs use the HTTP driver; internal Helium URLs use the WebSocket pool.
function createDb() {
  if (dbUrl!.includes('neon.tech')) {
    const sql = neon(dbUrl!);
    return drizzleHttp(sql, { schema });
  } else {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: dbUrl });
    return drizzleWs(pool, { schema });
  }
}

export const db = createDb();
