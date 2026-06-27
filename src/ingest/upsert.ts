import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";
import { items } from "@/db/schema";
import { contentHash } from "@/lib/hash";
import type { RawItem } from "./types";

// Phase 1 runs against the local (postgres-js) client. When the serverless cron
// arrives (Phase 4) this widens to also accept the neon-http client.
export type Database = PostgresJsDatabase<typeof schema>;

export interface UpsertResult {
  seen: number;
  /** Rows written (inserted or updated). */
  upserted: number;
}

/** Text whose hash detects content changes (and later gates re-embedding). */
const embeddableText = (item: RawItem): string => [item.title, item.abstract ?? ""].join("\n\n");

/** Keep the last occurrence per (source, externalId) so a single batch never
 * tries to update the same conflict target twice (Postgres rejects that). */
function dedupeBatch(rawItems: RawItem[]): RawItem[] {
  const byKey = new Map<string, RawItem>();
  for (const item of rawItems) byKey.set(`${item.source}:${item.externalId}`, item);
  return [...byKey.values()];
}

/**
 * Idempotent upsert by (source, external_id). Re-ingesting the same item updates
 * it in place instead of duplicating — a single INSERT ... ON CONFLICT statement
 * (so it also works over the HTTP driver, which has no interactive transactions).
 */
export async function upsertItems(db: Database, rawItems: RawItem[]): Promise<UpsertResult> {
  const batch = dedupeBatch(rawItems);
  if (batch.length === 0) return { seen: 0, upserted: 0 };

  const rows = batch.map((item) => ({
    source: item.source,
    externalId: item.externalId,
    url: item.url,
    title: item.title,
    abstract: item.abstract,
    authors: item.authors,
    publishedAt: item.publishedAt,
    contentHash: contentHash(embeddableText(item)),
    rawMetadata: item.rawMetadata,
  }));

  const written = await db
    .insert(items)
    .values(rows)
    .onConflictDoUpdate({
      target: [items.source, items.externalId],
      set: {
        url: sql`excluded.url`,
        title: sql`excluded.title`,
        abstract: sql`excluded.abstract`,
        authors: sql`excluded.authors`,
        publishedAt: sql`excluded.published_at`,
        contentHash: sql`excluded.content_hash`,
        rawMetadata: sql`excluded.raw_metadata`,
      },
    })
    .returning({ id: items.id });

  return { seen: batch.length, upserted: written.length };
}
