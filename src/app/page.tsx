export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">News Floater</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        An AI/ML research aggregator. Ingests arXiv and Hacker News (and a few AI blogs),
        deduplicates across sources, and serves a feed, hybrid semantic search, and grounded RAG
        chat over the corpus.
      </p>
      <p className="text-sm text-zinc-500">Scaffold in place — feed and search coming next.</p>
    </main>
  );
}
