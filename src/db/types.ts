import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

type Schema = typeof schema;

/**
 * A drizzle Postgres database bound to our schema, independent of driver. Both
 * the postgres-js client (local scripts) and the neon-serverless WebSocket
 * client (cron) satisfy this, so write helpers accept either. The neon-http
 * client also satisfies it for reads (it just can't do interactive transactions).
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type Transaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;
