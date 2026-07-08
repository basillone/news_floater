export interface ChunkOptions {
  /** Approx target size per chunk, in tokens. */
  maxTokens?: number;
  /** Approx tokens of trailing context carried into the next chunk. */
  overlapTokens?: number;
}

// ~4 chars per token is a decent rough estimate for English prose; good enough
// for sizing chunks without pulling in a tokenizer dependency.
const estimateTokens = (s: string): number => Math.ceil(s.length / 4);

const splitSentences = (text: string): string[] =>
  text
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [text];

/**
 * Split text into overlapping chunks on sentence boundaries. Short text (an
 * abstract) returns a single chunk; long text (a blog post) is windowed with
 * overlap so a relevant sentence isn't stranded across a boundary. Pure.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxTokens = opts.maxTokens ?? 800;
  const overlapTokens = opts.overlapTokens ?? 100;

  const trimmed = text.trim();
  if (!trimmed) return [];
  if (estimateTokens(trimmed) <= maxTokens) return [trimmed];

  const sentences = splitSentences(trimmed);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const tokens = estimateTokens(sentence);
    if (currentTokens + tokens > maxTokens && current.length > 0) {
      chunks.push(current.join(" "));
      // Carry trailing sentences as overlap into the next chunk.
      const overlap: string[] = [];
      let overlapAcc = 0;
      for (let i = current.length - 1; i >= 0 && overlapAcc < overlapTokens; i -= 1) {
        overlap.unshift(current[i]);
        overlapAcc += estimateTokens(current[i]);
      }
      current = overlap;
      currentTokens = overlapAcc;
    }
    current.push(sentence);
    currentTokens += tokens;
  }
  if (current.length > 0) chunks.push(current.join(" "));
  return chunks;
}

/** Embeddable text for a document: title + abstract, chunked. */
export function chunkDocument(
  doc: { title: string; abstract: string | null },
  opts?: ChunkOptions,
): string[] {
  const text = [doc.title, doc.abstract ?? ""].join("\n\n").trim();
  return chunkText(text, opts);
}
