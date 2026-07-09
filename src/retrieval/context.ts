import { getDocumentsByIds } from "@/db/queries";
import type { SourceName } from "@/ingest/types";
import { searchRankedIds } from "./search";

export interface SourceContext {
  index: number;
  documentId: string;
  title: string;
  url: string;
  source: SourceName;
}

export interface RetrievedContext {
  sources: SourceContext[];
  /** Numbered context block for the prompt. */
  contextBlock: string;
}

/**
 * Retrieve the top-k documents for a query (hybrid search) and format them as
 * numbered sources for grounded generation + citation. Reuses the same retrieval
 * path as the search UI.
 */
export async function retrieveContext(query: string, k = 6): Promise<RetrievedContext> {
  const ids = await searchRankedIds(query, { mode: "hybrid", limit: k });
  const docs = await getDocumentsByIds(ids);

  const sources: SourceContext[] = docs.map((d, i) => ({
    index: i + 1,
    documentId: d.id,
    title: d.title,
    url: d.url,
    source: d.canonicalSource,
  }));

  const contextBlock = docs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.title}\n${d.abstract ?? "(no abstract)"}\nSource: ${d.canonicalSource} — ${d.url}`,
    )
    .join("\n\n");

  return { sources, contextBlock };
}
