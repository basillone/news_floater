import { describe, expect, it } from "vitest";

import { shouldUpgradeCanonical } from "./resolve";

// The DB-backed resolve flow is verified via the live backfill (one document,
// two mentions, both orderings). Here we unit-test the pure precedence policy.
describe("shouldUpgradeCanonical", () => {
  it("upgrades HN content to arXiv when the paper arrives", () => {
    expect(shouldUpgradeCanonical("hn", "arxiv")).toBe(true);
  });
  it("does not let HN overwrite arXiv content", () => {
    expect(shouldUpgradeCanonical("arxiv", "hn")).toBe(false);
  });
  it("does not upgrade for an equal source", () => {
    expect(shouldUpgradeCanonical("arxiv", "arxiv")).toBe(false);
  });
  it("ranks rss between arxiv and hn", () => {
    expect(shouldUpgradeCanonical("hn", "rss")).toBe(true);
    expect(shouldUpgradeCanonical("rss", "arxiv")).toBe(true);
    expect(shouldUpgradeCanonical("rss", "hn")).toBe(false);
  });
});
