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
 * The canonical work (a paper / post). Cross-source duplicates collapse into one
 * document; each appearance lives in `mentions`. Embeddings (chunks) attach here.
 * `canonicalSource` records which source currently provides the content (arXiv
 * outranks HN — see src/ingest/resolve.ts).
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Cross-source identity (e.g. "arxiv:2401.12345"); null when there's none.
    dedupKey: text("dedup_key"),
    title: text("title").notNull(),
    abstract: text("abstract"),
    content: text("content"),
    authors: text("authors").array(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    canonicalSource: sourceEnum("canonical_source").notNull(),
    // Hash of the embeddable text — guards against re-embedding unchanged content.
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("documents_dedup_key_idx")
      .on(t.dedupKey)
      .where(sql`${t.dedupKey} is not null`),
    index("documents_published_at_idx").on(t.publishedAt),
  ],
);

/**
 * One row per appearance of a document in a source (an arXiv entry, an HN story).
 * Holds the per-source url, external id, and signal (HN points, arXiv categories).
 */
export const mentions = pgTable(
  "mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    source: sourceEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    sourceMetadata: jsonb("source_metadata"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Idempotency: re-ingesting the same source item upserts, never duplicates.
    uniqueIndex("mentions_source_external_id_idx").on(t.source, t.externalId),
    index("mentions_document_id_idx").on(t.documentId),
  ],
);

/** Embeddable units, attached to the canonical document. */
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // OpenAI text-embedding-3-small. Dimensions are a lock-in decision (1536).
    embedding: vector("embedding", { dimensions: 1536 }),
    tokenCount: integer("token_count"),
  },
  (t) => [
    index("chunks_document_id_idx").on(t.documentId),
    index("chunks_embedding_hnsw_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

/** Observability: one row per ingestion run. */
export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: sourceEnum("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  itemsSeen: integer("items_seen").default(0).notNull(),
  documentsWritten: integer("documents_written").default(0).notNull(),
  mentionsWritten: integer("mentions_written").default(0).notNull(),
  status: runStatusEnum("status").notNull().default("ok"),
  error: text("error"),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
