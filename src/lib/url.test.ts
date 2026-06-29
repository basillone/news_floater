import { describe, expect, it } from "vitest";

import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("lowercases scheme and host and drops www.", () => {
    expect(normalizeUrl("HTTPS://WWW.Example.com/Path")).toBe("https://example.com/Path");
  });

  it("strips utm_* and known tracking params", () => {
    expect(normalizeUrl("https://example.com/a?utm_source=x&utm_medium=y&id=42")).toBe(
      "https://example.com/a?id=42",
    );
    expect(normalizeUrl("https://example.com/a?fbclid=abc&ref=hn")).toBe("https://example.com/a");
  });

  it("removes the fragment", () => {
    expect(normalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("drops a trailing slash but keeps the root", () => {
    expect(normalizeUrl("https://example.com/a/")).toBe("https://example.com/a");
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts remaining query params for stable output", () => {
    expect(normalizeUrl("https://example.com/a?b=2&a=1")).toBe("https://example.com/a?a=1&b=2");
  });

  it("is idempotent", () => {
    const once = normalizeUrl("https://WWW.example.com/a/?utm_source=x&b=2&a=1#frag");
    expect(normalizeUrl(once)).toBe(once);
  });

  it("returns the trimmed input when it doesn't parse", () => {
    expect(normalizeUrl("  not a url  ")).toBe("not a url");
  });
});
