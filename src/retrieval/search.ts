import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { chunks, documents, type Document } from "@/db/schema";
import { embedQuery } from "@/embeddings";
import { reciprocalRankFusion } from "./rrf";

const CANDIDATES = 50;
const DEFAULT_LIMIT = 10;

export type SearchMode = "hybrid" | "semantic" | "keyword";

export interface SearchOptions {
  limit?: number;
  mode?: SearchMode;
}

/** Document ids ranked by best (min) cosine distance to the query embedding. */
async function semanticSearchIds(queryEmbedding: number[], limit = CANDIDATES): Promise<string[]> {
  const vec = `[${queryEmbedding.join(",")}]`;
  const rows = await db
    .select({ documentId: chunks.documentId })
    .from(chunks)
    .groupBy(chunks.documentId)
    .orderBy(sql`min(${chunks.embedding} <=> ${vec}::vector)`)
    .limit(limit);
  return rows.map((r) => r.documentId);
}

/**
 * Document ids ranked by Postgres full-text relevance (ts_rank). Terms are OR'd
 * (recall any term) and ranked by match quality, rather than AND'd — otherwise a
 * multi-word query requires every word present, which tanks recall on a small
 * corpus. Input is reduced to alphanumeric tokens, so it's safe for to_tsquery.
 */
async function keywordSearchIds(query: string, limit = CANDIDATES): Promise<string[]> {
  const terms = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  if (terms.length === 0) return [];
  const tsquery = sql`to_tsquery('english', ${terms.join(" | ")})`;
  const rows = await db
    .select({ documentId: documents.id })
    .from(documents)
    .where(sql`${documents.searchVector} @@ ${tsquery}`)
    .orderBy(sql`ts_rank(${documents.searchVector}, ${tsquery}) desc`)
    .limit(limit);
  return rows.map((r) => r.documentId);
}

/** Fetch documents by id and return them in the given ranked order. */
async function hydrate(rankedIds: string[]): Promise<Document[]> {
  if (rankedIds.length === 0) return [];
  const docs = await db.select().from(documents).where(inArray(documents.id, rankedIds));
  const byId = new Map(docs.map((d) => [d.id, d]));
  return rankedIds.map((id) => byId.get(id)).filter((d): d is Document => d !== undefined);
}

/**
 * Hybrid retrieval ranking: semantic (pgvector) + keyword (Postgres FTS) fused
 * with RRF, returning ranked document ids (the re-ranker seam is here). `mode`
 * allows semantic-only / keyword-only. Callers hydrate the ids for their needs
 * (the feed/search UI attaches mentions; the eval just checks the docs).
 */
export async function searchRankedIds(query: string, opts: SearchOptions = {}): Promise<string[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const mode = opts.mode ?? "hybrid";

  let rankedIds: string[];
  if (mode === "keyword") {
    rankedIds = await keywordSearchIds(query);
  } else if (mode === "semantic") {
    rankedIds = await semanticSearchIds(await embedQuery(query));
  } else {
    const embedding = await embedQuery(query);
    const [semantic, keyword] = await Promise.all([
      semanticSearchIds(embedding),
      keywordSearchIds(query),
    ]);
    rankedIds = reciprocalRankFusion([semantic, keyword]).map((r) => r.id);
  }

  return rankedIds.slice(0, limit);
}

/** Hybrid search returning hydrated documents in ranked order. */
export async function search(query: string, opts: SearchOptions = {}): Promise<Document[]> {
  return hydrate(await searchRankedIds(query, opts));
}
