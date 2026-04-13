import { neon, Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzleWs } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Public Neon URLs (sitesensei.gasco.digital production) use the HTTP driver.
// Internal/Replit Helium URLs use the WebSocket pool driver.
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
