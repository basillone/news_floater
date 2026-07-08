import { and, eq, sql } from "drizzle-orm";

import { documents, mentions, type NewDocument } from "@/db/schema";
import type { Database, Transaction as Tx } from "@/db/types";
import { contentHash } from "@/lib/hash";
import { deriveDedupKey } from "./dedup";
import type { RawItem, SourceName } from "./types";

// Resolve-or-create is read-then-write, so it runs in a transaction. `Database`
// is driver-agnostic (src/db/types.ts): local scripts pass the postgres-js
// client, the cron passes the neon-serverless WebSocket client — the HTTP driver
// can't do interactive transactions. See private-notes/14-jobs-and-serverless.md.

// Canonical-content precedence: arXiv (real abstract) > RSS > HN (often link-only).
const PRECEDENCE: Record<SourceName, number> = { arxiv: 3, rss: 2, hn: 1 };

/** Whether `incoming` should overwrite the document's canonical content. */
export function shouldUpgradeCanonical(current: SourceName, incoming: SourceName): boolean {
  return PRECEDENCE[incoming] > PRECEDENCE[current];
}

export interface WriteResult {
  seen: number;
  documentsWritten: number;
  mentionsWritten: number;
}

const embeddableText = (item: RawItem): string => [item.title, item.abstract ?? ""].join("\n\n");

/**
 * Resolve the document a RawItem belongs to (existing mention → existing dedup
 * match → new document), apply the canonical-content precedence, then upsert the
 * mention. Order-independent: HN-before-paper and paper-before-HN both converge.
 */
async function resolveItem(tx: Tx, item: RawItem): Promise<{ createdDocument: boolean }> {
  const dedupKey = deriveDedupKey(item);

  // 1. Already have a mention for this exact source item?
  const [existingMention] = await tx
    .select({ documentId: mentions.documentId })
    .from(mentions)
    .where(and(eq(mentions.source, item.source), eq(mentions.externalId, item.externalId)))
    .limit(1);
  let documentId = existingMention?.documentId ?? null;

  // 2. Else does the dedup key resolve to an existing document?
  if (!documentId && dedupKey) {
    const [doc] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.dedupKey, dedupKey))
      .limit(1);
    documentId = doc?.id ?? null;
  }

  let createdDocument = false;
  if (!documentId) {
    // 3. New work.
    const [doc] = await tx
      .insert(documents)
      .values({
        dedupKey,
        title: item.title,
        abstract: item.abstract,
        authors: item.authors,
        publishedAt: item.publishedAt,
        canonicalSource: item.source,
        contentHash: contentHash(embeddableText(item)),
      })
      .returning({ id: documents.id });
    documentId = doc.id;
    createdDocument = true;
  } else {
    // Maybe upgrade canonical content / backfill a missing dedup key.
    const [doc] = await tx.select().from(documents).where(eq(documents.id, documentId)).limit(1);
    if (doc) {
      const patch: Partial<NewDocument> = {};
      if (shouldUpgradeCanonical(doc.canonicalSource, item.source)) {
        patch.title = item.title;
        patch.abstract = item.abstract;
        patch.authors = item.authors;
        patch.publishedAt = item.publishedAt;
        patch.canonicalSource = item.source;
        patch.contentHash = contentHash(embeddableText(item));
      }
      if (!doc.dedupKey && dedupKey) patch.dedupKey = dedupKey;
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = new Date();
        await tx.update(documents).set(patch).where(eq(documents.id, documentId));
      }
    }
  }

  await tx
    .insert(mentions)
    .values({
      documentId,
      source: item.source,
      externalId: item.externalId,
      url: item.url,
      sourceMetadata: item.rawMetadata,
      publishedAt: item.publishedAt,
    })
    .onConflictDoUpdate({
      target: [mentions.source, mentions.externalId],
      set: {
        documentId,
        url: sql`excluded.url`,
        sourceMetadata: sql`excluded.source_metadata`,
        publishedAt: sql`excluded.published_at`,
      },
    });

  return { createdDocument };
}

/**
 * Write a batch of RawItems as documents + mentions. Runs in a single
 * transaction; items are processed in order so an arXiv document created earlier
 * in the batch is found by a later HN item with the same dedup key.
 */
export async function writeItems(db: Database, items: RawItem[]): Promise<WriteResult> {
  if (items.length === 0) return { seen: 0, documentsWritten: 0, mentionsWritten: 0 };

  let documentsWritten = 0;
  await db.transaction(async (tx) => {
    for (const item of items) {
      const { createdDocument } = await resolveItem(tx, item);
      if (createdDocument) documentsWritten += 1;
    }
  });

  return { seen: items.length, documentsWritten, mentionsWritten: items.length };
}
