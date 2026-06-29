import { describe, expect, it } from "vitest";

import { deriveDedupKey, extractArxivId, stripArxivVersion } from "./dedup";
import type { RawItem } from "./types";

describe("stripArxivVersion", () => {
  it("removes a trailing version", () => {
    expect(stripArxivVersion("2401.12345v2")).toBe("2401.12345");
    expect(stripArxivVersion("2401.12345v15")).toBe("2401.12345");
  });
  it("leaves an unversioned id untouched", () => {
    expect(stripArxivVersion("2401.12345")).toBe("2401.12345");
  });
});

describe("extractArxivId", () => {
  it("extracts from an abs URL", () => {
    expect(extractArxivId("https://arxiv.org/abs/2401.12345v2")).toBe("2401.12345");
  });
  it("extracts from a pdf URL with and without .pdf suffix", () => {
    expect(extractArxivId("http://arxiv.org/pdf/2401.12345")).toBe("2401.12345");
    expect(extractArxivId("https://arxiv.org/pdf/2401.12345v3.pdf")).toBe("2401.12345");
  });
  it("handles the www host", () => {
    expect(extractArxivId("https://www.arxiv.org/abs/2402.00001")).toBe("2402.00001");
  });
  it("returns null for non-arXiv URLs", () => {
    expect(extractArxivId("https://example.com/abs/2401.12345")).toBeNull();
    expect(extractArxivId("https://openai.com/blog/x")).toBeNull();
  });
  it("returns null for unparseable input", () => {
    expect(extractArxivId("not a url")).toBeNull();
  });
});

const baseItem = (over: Partial<RawItem>): RawItem => ({
  source: "hn",
  externalId: "1",
  url: "https://example.com",
  title: "t",
  abstract: null,
  authors: [],
  publishedAt: null,
  rawMetadata: {},
  ...over,
});

describe("deriveDedupKey", () => {
  it("keys arXiv items on their version-stripped id", () => {
    expect(deriveDedupKey(baseItem({ source: "arxiv", externalId: "2401.12345v2" }))).toBe(
      "arxiv:2401.12345",
    );
  });
  it("keys an HN story that links to arXiv on that paper", () => {
    expect(
      deriveDedupKey(baseItem({ source: "hn", url: "https://arxiv.org/abs/2401.12345v1" })),
    ).toBe("arxiv:2401.12345");
  });
  it("returns null for an HN story with no arXiv link", () => {
    expect(deriveDedupKey(baseItem({ source: "hn", url: "https://example.com/post" }))).toBeNull();
  });
});
