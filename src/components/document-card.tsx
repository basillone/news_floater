import type { DocumentView } from "@/db/queries";
import { SourceBadge } from "./source-badge";

const formatDate = (d: Date | null): string | null =>
  d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null;

export function DocumentCard({ doc }: { doc: DocumentView }) {
  const sources = [...new Set(doc.mentions.map((m) => m.source))];
  const hn = doc.mentions.find((m) => m.source === "hn");
  const date = formatDate(doc.publishedAt);
  const authors = doc.authors.slice(0, 4).join(", ");

  return (
    <article className="border-b border-zinc-200 py-5 dark:border-zinc-800">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {sources.map((s) => (
          <SourceBadge key={s} source={s} />
        ))}
      </div>

      <h2 className="text-base font-semibold leading-snug">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-900 hover:underline dark:text-zinc-50"
        >
          {doc.title}
        </a>
      </h2>

      {doc.abstract && (
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {doc.abstract}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
        {authors && <span className="truncate">{authors}</span>}
        {date && <span>{date}</span>}
        {hn && (
          <a
            href={hn.hnUrl ?? hn.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-600 hover:underline dark:text-orange-400"
          >
            {hn.points != null ? `${hn.points} points` : "HN"} · discuss
          </a>
        )}
      </div>
    </article>
  );
}
