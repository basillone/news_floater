import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

// Locked: 1536 dims. Changing the model/dims means re-embedding the whole corpus
// (see private-notes/03-embeddings.md). The provider stays behind this module so
// it's swappable (e.g. to Voyage) without touching callers.
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const model = openai.textEmbeddingModel(EMBEDDING_MODEL);

/** Embed many texts (batched by the SDK). Returns vectors in input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({ model, values: texts });
  return embeddings;
}

/** Embed a single query string. */
export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({ model, value: text });
  return embedding;
}
