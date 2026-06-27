import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * DB client for local scripts (backfill, one-off tasks) — NOT for serverless.
 * A single long-lived TCP connection is the right shape for one long-running
 * process: no per-query HTTP overhead, and no exhaustion risk in a single
 * process. See private-notes/11-technical-deep-dives.md.
 */
const client = postgres(env.DATABASE_URL, { max: 1 });

export const db = drizzle(client, { schema });
export const closeDb = () => client.end();
