-- pgvector must exist before the `vector` column and HNSW index below.
-- (Manually added; drizzle-kit does not emit extension statements.)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('ok', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('arxiv', 'hn', 'rss');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" text,
	"title" text NOT NULL,
	"abstract" text,
	"content" text,
	"authors" text[],
	"published_at" timestamp with time zone,
	"canonical_source" "source" NOT NULL,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "source" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"documents_written" integer DEFAULT 0 NOT NULL,
	"mentions_written" integer DEFAULT 0 NOT NULL,
	"status" "run_status" DEFAULT 'ok' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"source" "source" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"source_metadata" jsonb,
	"published_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_document_id_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "documents_dedup_key_idx" ON "documents" USING btree ("dedup_key") WHERE "documents"."dedup_key" is not null;--> statement-breakpoint
CREATE INDEX "documents_published_at_idx" ON "documents" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "mentions_source_external_id_idx" ON "mentions" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "mentions_document_id_idx" ON "mentions" USING btree ("document_id");