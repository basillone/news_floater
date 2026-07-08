import type { SourceName } from "@/ingest/types";

const LABELS: Record<SourceName, string> = {
  arxiv: "arXiv",
  hn: "Hacker News",
  rss: "Blog",
};

const STYLES: Record<SourceName, string> = {
  arxiv: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  hn: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  rss: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
};

export function SourceBadge({ source }: { source: SourceName }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${STYLES[source]}`}
    >
      {LABELS[source]}
    </span>
  );
}
