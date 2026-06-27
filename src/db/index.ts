import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env";
import * as schema from "./schema";

/**
 * App / serverless DB client. Uses Neon's HTTP driver: each query is a single
 * stateless HTTPS request, so there are no connections to exhaust across many
 * concurrent Vercel function invocations. See
 * private-notes/11-technical-deep-dives.md.
 *
 * Note: the HTTP driver does not support interactive transactions. Express
 * read-then-write logic as a single statement (e.g. INSERT ... ON CONFLICT).
 */
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
