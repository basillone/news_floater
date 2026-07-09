"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

import { Markdown } from "@/components/markdown";
import { SourceBadge } from "@/components/source-badge";
import type { ChatMessage } from "@/llm/types";
import type { SourceContext } from "@/retrieval/context";

function Sources({ sources }: { sources: SourceContext[] }) {
  if (sources.length === 0) return null;
  return (
    <ol className="mt-3 space-y-1 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-800">
      {sources.map((s) => (
        <li key={s.documentId} className="flex gap-1.5 text-zinc-500">
          <span className="tabular-nums">[{s.index}]</span>
          <SourceBadge source={s.source} />
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:underline"
          >
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <div className="flex-1 space-y-6">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-500">
            Ask a question about the corpus. Answers are grounded in retrieved sources and cited.
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id}>
            <div className="mb-1 text-xs font-medium text-zinc-500">
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            <div className="text-sm leading-relaxed">
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "assistant" ? (
                    <Markdown key={i}>{part.text}</Markdown>
                  ) : (
                    <p key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                if (part.type === "data-sources") {
                  return <Sources key={i} sources={part.data} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && <p className="text-sm text-zinc-500">Retrieving + thinking…</p>}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Something went wrong: {error.message}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="mt-6 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the corpus…"
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      </form>
    </main>
  );
}
