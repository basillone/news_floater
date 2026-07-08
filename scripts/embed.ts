import "./load-env";
import { inArray, sql } from "drizzle-orm";

import { closeDb, db } from "@/db/node";
import { chunks, documents } from "@/db/schema";
import { embedTexts } from "@/embeddings";
import { chunkDocument } from "@/ingest/chunk";

const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

async function main() {
  const force = process.argv.includes("--force");

  let docs;
  if (force) {
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
    // Documents that don't yet have any chunks.
    docs = await db
      .select()
      .from(documents)
      .where(sql`not exists (select 1 from chunks c where c.document_id = ${documents.id})`);
  }

  console.log(`${docs.length} document(s) to embed${force ? " (--force)" : ""}`);
  if (docs.length === 0) {
    await closeDb();
    return;
  }

  // Flatten to (documentId, chunkIndex, content), then embed all at once.
  const pending = docs.flatMap((doc) =>
    chunkDocument({ title: doc.title, abstract: doc.abstract }).map((content, chunkIndex) => ({
      documentId: doc.id,
      chunkIndex,
      content,
    })),
  );

  console.log(`embedding ${pending.length} chunk(s)...`);
  const embeddings = await embedTexts(pending.map((p) => p.content));

  const rows = pending.map((p, i) => ({
    documentId: p.documentId,
    chunkIndex: p.chunkIndex,
    content: p.content,
    embedding: embeddings[i],
    tokenCount: estimateTokens(p.content),
  }));

  await db.insert(chunks).values(rows);
  console.log(`inserted ${rows.length} chunk(s)`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
