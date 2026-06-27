import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// Sources are a typed enum + const config, not a table — see
// private-notes/02-database-and-schema.md ("Why no `sources` table").
export const sourceEnum = pgEnum("source", ["arxiv", "hn", "rss"]);
export const runStatusEnum = pgEnum("run_status", ["ok", "partial", "failed"]);

/**
 * Canonical content item. One row per logical item; cross-source duplicates are
 * collapsed via `dedupKey` rather than stored twice.
 */
export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: sourceEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    abstract: text("abstract"),
    content: text("content"),
    authors: text("authors").array(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
    // Hash of the embeddable text — guards against re-embedding unchanged content.
    contentHash: text("content_hash"),
    // Normalized cross-source identity (e.g. version-stripped arXiv id).
    dedupKey: text("dedup_key"),
    // Source-specific extras: HN score/comments url, arXiv categories, etc.
    rawMetadata: jsonb("raw_metadata"),
  },
  (t) => [
    // Idempotency: re-ingesting the same source item upserts, never duplicates.
    uniqueIndex("items_source_external_id_idx").on(t.source, t.externalId),
    index("items_dedup_key_idx")
      .on(t.dedupKey)
      .where(sql`${t.dedupKey} is not null`),
    index("items_published_at_idx").on(t.publishedAt),
  ],
);

/**
 * Embeddable units. Abstracts are one chunk; longer text is split. Embeddings
 * live here (not on `items`) precisely because of chunking.
 */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // OpenAI text-embedding-3-small. Dimensions are a lock-in decision (1536).
    embedding: vector("embedding", { dimensions: 1536 }),
    tokenCount: integer("token_count"),
  },
  (t) => [
    index("chunks_item_id_idx").on(t.itemId),
    index("chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** Observability: one row per ingestion run. Operate it, don't just build it. */
export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: sourceEnum("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsSeen: integer("items_seen").default(0).notNull(),
  itemsUpserted: integer("items_upserted").default(0).notNull(),
  status: runStatusEnum("status").notNull().default("ok"),
  error: text("error"),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
