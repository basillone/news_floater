import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Compact styling tuned for chat bubbles (react-markdown renders assistant output,
// which streams partial markdown — it degrades gracefully as tokens arrive).
const components: Components = {
  h1: (props) => <h3 className="mb-1 mt-4 text-base font-semibold" {...props} />,
  h2: (props) => <h3 className="mb-1 mt-4 text-base font-semibold" {...props} />,
  h3: (props) => <h4 className="mb-1 mt-3 text-sm font-semibold" {...props} />,
  p: (props) => <p className="mb-2 leading-relaxed last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  a: (props) => (
    <a
      className="underline hover:no-underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: (props) => (
    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] dark:bg-zinc-800" {...props} />
  ),
  pre: (props) => (
    <pre
      className="mb-2 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      {...props}
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
