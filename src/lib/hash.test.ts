import { describe, expect, it } from "vitest";

import { contentHash } from "./hash";

describe("contentHash", () => {
  it("is stable for identical input", () => {
    expect(contentHash("hello world")).toBe(contentHash("hello world"));
  });

  it("differs for different input", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });

  it("produces a 64-char hex sha256 digest", () => {
    expect(contentHash("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});
