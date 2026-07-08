import { Suspense } from "react";

import { DocumentCard } from "@/components/document-card";
import { SearchForm } from "@/components/search-form";
import { getDocumentsByIds } from "@/db/queries";
import { searchRankedIds, type SearchMode } from "@/retrieval/search";

export const dynamic = "force-dynamic";

const MODES = ["hybrid", "semantic", "keyword"] as const;
const toMode = (m?: string): SearchMode =>
  MODES.includes(m as SearchMode) ? (m as SearchMode) : "hybrid";

async function Results({ query, mode }: { query: string; mode: SearchMode }) {
  const ids = await searchRankedIds(query, { mode, limit: 20 });
  const docs = await getDocumentsByIds(ids);

  if (docs.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">No results for “{query}”.</p>;
  }

  return (
    <div className="mt-4">
      <p className="mb-1 text-xs text-zinc-500">
        {docs.length} result{docs.length === 1 ? "" : "s"} · {mode}
      </p>
      {docs.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} />
      ))}
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string }>;
}) {
  const { q, mode } = await searchParams;
  const query = q?.trim() ?? "";
  const searchMode = toMode(mode);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <SearchForm defaultQuery={query} defaultMode={searchMode} />

      {query === "" ? (
        <p className="py-12 text-center text-sm text-zinc-500">
          Search across the corpus with hybrid semantic + keyword retrieval.
        </p>
      ) : (
        <Suspense
          key={`${query}:${searchMode}`}
          fallback={<p className="py-12 text-center text-sm text-zinc-500">Searching…</p>}
        >
          <Results query={query} mode={searchMode} />
        </Suspense>
      )}
    </main>
  );
}
