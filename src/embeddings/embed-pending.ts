import { inArray, sql } from "drizzle-orm";

import { chunks, documents } from "@/db/schema";
import type { Database } from "@/db/types";
import { chunkDocument } from "@/ingest/chunk";
import { embedTexts } from "./index";

const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

export interface EmbedResult {
  documentsEmbedded: number;
  chunksInserted: number;
}

/**
 * Embed documents that don't yet have chunks (or all, with `force`). Shared by
 * the local backfill script and the serverless cron sync. Idempotent: skips
 * documents that already have chunks.
 */
export async function embedPending(
  db: Database,
  opts: { force?: boolean } = {},
): Promise<EmbedResult> {
  let docs;
  if (opts.force) {
    docs = await db.select().from(documents);
    if (docs.length > 0) {
      await db.delete(chunks).where(
        inArray(
          chunks.documentId,
          docs.map((d) => d.id),
        ),
      );
    }
  } else {
    docs = await db
      .select()
      .from(documents)
      .where(sql`not exists (select 1 from chunks c where c.document_id = ${documents.id})`);
  }

  if (docs.length === 0) return { documentsEmbedded: 0, chunksInserted: 0 };

  const pending = docs.flatMap((doc) =>
    chunkDocument({ title: doc.title, abstract: doc.abstract }).map((content, chunkIndex) => ({
      documentId: doc.id,
      chunkIndex,
      content,
    })),
  );

  const embeddings = await embedTexts(pending.map((p) => p.content));
  const rows = pending.map((p, i) => ({
    documentId: p.documentId,
    chunkIndex: p.chunkIndex,
    content: p.content,
    embedding: embeddings[i],
    tokenCount: estimateTokens(p.content),
  }));

  await db.insert(chunks).values(rows);
  return { documentsEmbedded: docs.length, chunksInserted: rows.length };
}
