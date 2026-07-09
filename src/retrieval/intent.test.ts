import { describe, expect, it } from "vitest";

import { isRecencyQuery } from "./intent";

describe("isRecencyQuery", () => {
  it("detects temporal / aggregation queries", () => {
    for (const q of [
      "what are the top stories from the last week",
      "what's new in AI",
      "show me the latest papers",
      "anything recent on diffusion",
      "catch me up on this week",
      "what's trending",
    ]) {
      expect(isRecencyQuery(q)).toBe(true);
    }
  });

  it("does not fire on content questions", () => {
    for (const q of [
      "what approaches to RLHF are in the corpus",
      "explain graph neural networks",
      "how does KV cache compression work",
      "papers about video generation",
    ]) {
      expect(isRecencyQuery(q)).toBe(false);
    }
  });
});
