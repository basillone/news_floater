import type { SearchMode } from "@/retrieval/search";

export function SearchForm({
  defaultQuery = "",
  defaultMode = "hybrid",
}: {
  defaultQuery?: string;
  defaultMode?: SearchMode;
}) {
  return (
    <form action="/search" method="get" className="flex gap-2">
      <input
        name="q"
        type="search"
        defaultValue={defaultQuery}
        placeholder="Search the corpus…"
        autoFocus
        className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
      />
      <select
        name="mode"
        defaultValue={defaultMode}
        aria-label="Search mode"
        className="rounded-md border border-zinc-300 bg-transparent px-2 py-2 text-sm dark:border-zinc-700"
      >
        <option value="hybrid">Hybrid</option>
        <option value="semantic">Semantic</option>
        <option value="keyword">Keyword</option>
      </select>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Search
      </button>
    </form>
  );
}
