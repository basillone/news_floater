import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "./rrf";

describe("reciprocalRankFusion", () => {
  it("ranks an item appearing high in both lists first", () => {
    const semantic = ["a", "b", "c"];
    const keyword = ["b", "a", "d"];
    const fused = reciprocalRankFusion([semantic, keyword]);
    // "a" (1,2) and "b" (2,1) both score 1/61 + 1/62; tie broken by insertion.
    expect(
      fused
        .slice(0, 2)
        .map((r) => r.id)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(fused.map((r) => r.id)).toContain("d");
  });

  it("rewards agreement: an item in both lists beats a list-leader in only one", () => {
    // "x" leads list 1 only; "y" is 2nd in both.
    const l1 = ["x", "y"];
    const l2 = ["z", "y"];
    const fused = reciprocalRankFusion([l1, l2]);
    expect(fused[0].id).toBe("y");
  });

  it("handles a single list", () => {
    expect(reciprocalRankFusion([["a", "b"]]).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for no lists / empty lists", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("scores are descending", () => {
    const fused = reciprocalRankFusion([["a", "b", "c"]]);
    for (let i = 1; i < fused.length; i += 1) {
      expect(fused[i - 1].score).toBeGreaterThanOrEqual(fused[i].score);
    }
  });
});
