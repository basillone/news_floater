import { describe, expect, it } from "vitest";

import { parseHnSearch } from "./hn";

const RESPONSE = {
  hits: [
    {
      objectID: "100",
      title: "A paper on LLMs",
      url: "https://arxiv.org/abs/2401.12345",
      author: "pg",
      points: 142,
      num_comments: 37,
      created_at: "2024-01-16T10:00:00.000Z",
      story_text: null,
    },
    {
      objectID: "101",
      title: "Ask HN: best way to learn ML?",
      url: null,
      author: "dang",
      points: 5,
      num_comments: 2,
      created_at: "2024-02-01T12:00:00.000Z",
      story_text: "I want to learn <b>ML</b> &amp; more.",
    },
  ],
};

describe("parseHnSearch", () => {
  it("maps a link story to a RawItem", () => {
    const [first] = parseHnSearch(RESPONSE);
    expect(first.source).toBe("hn");
    expect(first.externalId).toBe("100");
    expect(first.url).toBe("https://arxiv.org/abs/2401.12345");
    expect(first.authors).toEqual(["pg"]);
    expect(first.rawMetadata).toMatchObject({
      points: 142,
      numComments: 37,
      hnUrl: "https://news.ycombinator.com/item?id=100",
    });
  });

  it("falls back to the HN page url for text posts and strips HTML from story_text", () => {
    const second = parseHnSearch(RESPONSE)[1];
    expect(second.url).toBe("https://news.ycombinator.com/item?id=101");
    expect(second.abstract).toBe("I want to learn ML & more.");
  });

  it("throws on a malformed payload", () => {
    expect(() => parseHnSearch({ hits: [{ title: "no objectID" }] })).toThrow();
  });
});
