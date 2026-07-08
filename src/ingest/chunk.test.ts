import { describe, expect, it } from "vitest";

import { chunkDocument, chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns a single chunk for short text", () => {
    expect(chunkText("A short abstract about transformers.")).toEqual([
      "A short abstract about transformers.",
    ]);
  });

  it("returns an empty array for empty/whitespace input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("splits long text into multiple chunks with overlap", () => {
    const sentence = "This sentence has a few words in it. ";
    const long = sentence.repeat(80); // ~2300 tokens worth
    const chunks = chunkText(long, { maxTokens: 200, overlapTokens: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk is within a reasonable bound of the target.
    for (const c of chunks) expect(c.length).toBeLessThan(200 * 4 + 200);
    // Overlap: the end of chunk 0 reappears at the start of chunk 1.
    const tail = chunks[0].split(" ").slice(-5).join(" ");
    expect(chunks[1]).toContain(tail);
  });
});

describe("chunkDocument", () => {
  it("combines title and abstract", () => {
    const [chunk] = chunkDocument({
      title: "Attention Is All You Need",
      abstract: "We propose...",
    });
    expect(chunk).toContain("Attention Is All You Need");
    expect(chunk).toContain("We propose...");
  });

  it("handles a null abstract", () => {
    expect(chunkDocument({ title: "Just a title", abstract: null })).toEqual(["Just a title"]);
  });
});
