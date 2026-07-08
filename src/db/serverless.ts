import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { env } from "@/env";
import * as schema from "./schema";

// The WebSocket driver needs a WebSocket constructor. Node 22+ has a global one,
// but setting it explicitly with `ws` works across runtimes/versions.
neonConfig.webSocketConstructor = ws;

/**
 * WebSocket-driver client for serverless code that needs interactive
 * transactions (the cron sync's resolve-or-create write path). Unlike the HTTP
 * client (`src/db/index.ts`), this supports `db.transaction(...)`. Create it per
 * invocation and `close()` when done. See private-notes/14-jobs-and-serverless.md.
 */
export function createServerlessDb() {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
