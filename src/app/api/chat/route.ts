import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";

import { buildSystemPrompt, chatModel } from "@/llm/chat";
import type { ChatMessage } from "@/llm/types";
import { retrieveContext } from "@/retrieval/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Text of the most recent user message — the retrieval query. */
function latestUserText(messages: ChatMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return "";
  return last.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
}

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();
  const { sources, contextBlock } = await retrieveContext(latestUserText(messages), 6);

  // Surface the real error to the client (this is a dev-facing tool). A stricter
  // production app would log server-side and return a sanitized message.
  const onError = (error: unknown) =>
    error instanceof Error ? error.message : "Something went wrong.";

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // Emit the retrieved sources first so the UI can render citations.
      writer.write({ type: "data-sources", id: "sources", data: sources });

      const result = streamText({
        model: chatModel,
        system: buildSystemPrompt(contextBlock),
        messages: await convertToModelMessages(messages),
      });
      // onError here surfaces model/streaming errors (rate limits, access, etc.).
      writer.merge(result.toUIMessageStream({ onError }));
    },
    onError,
  });

  return createUIMessageStreamResponse({ stream });
}
