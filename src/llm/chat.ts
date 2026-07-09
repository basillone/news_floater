import { openai } from "@ai-sdk/openai";

// Single-provider stack: OpenAI for embeddings AND chat, behind this seam so the
// choice is deliberately swappable (e.g. to Claude) without touching callers.
// See DECISIONS.md / private-notes/05-llm-and-rag.md.
export const chatModel = openai("gpt-4o-mini");

const SYSTEM_PROMPT = `You are a research assistant for an AI/ML paper + discussion corpus.

Answer the user's question using ONLY the numbered sources provided below. Rules:
- Ground every claim in the sources and cite them inline with bracketed numbers, e.g. [1], [2].
- If the sources do not contain enough information to answer, say so plainly (e.g. "I don't have anything in the corpus on that.") and do NOT use outside knowledge.
- Be concise. Prefer specifics from the sources over generalities.`;

/** System prompt with the retrieved sources appended as grounding context. */
export function buildSystemPrompt(contextBlock: string): string {
  if (contextBlock.trim() === "") {
    return `${SYSTEM_PROMPT}\n\nSources:\n(none found for this query)`;
  }
  return `${SYSTEM_PROMPT}\n\nSources:\n${contextBlock}`;
}
