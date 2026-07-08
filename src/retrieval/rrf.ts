export interface FusedResult {
  id: string;
  score: number;
}

/**
 * Reciprocal Rank Fusion: combine several ranked id lists into one ranking by
 * summing 1/(k + rank) across lists. Rank-based, so the lists' incomparable
 * score scales (cosine distance vs ts_rank) don't matter. Pure.
 *
 * @param lists ranked id lists, best first
 * @param k smoothing constant (60 is the standard default)
 */
export function reciprocalRankFusion(lists: string[][], k = 60): FusedResult[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => {
      const rank = index + 1;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
