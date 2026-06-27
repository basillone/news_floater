-- pgvector must exist before the `vector` column and HNSW index below.
-- (Manually added; drizzle-kit does not emit extension statements.)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('ok', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('arxiv', 'hn', 'rss');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_upserted" integer DEFAULT 0 NOT NULL,
	"status" "run_status" DEFAULT 'ok' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"content" text,
	"authors" text[],
	"published_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text,
	"dedup_key" text,
	"raw_metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_item_id_idx" ON "chunks" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "items_source_external_id_idx" ON "items" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "items_dedup_key_idx" ON "items" USING btree ("dedup_key") WHERE "items"."dedup_key" is not null;--> statement-breakpoint
CREATE INDEX "items_published_at_idx" ON "items" USING btree ("published_at");