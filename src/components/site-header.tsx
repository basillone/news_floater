import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          News Floater
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Feed
          </Link>
          <Link href="/search" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Search
          </Link>
          <Link href="/chat" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Chat
          </Link>
        </nav>
      </div>
    </header>
  );
}
