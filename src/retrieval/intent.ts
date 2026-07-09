// Pure query-intent helpers, kept free of DB/env imports so they're unit-testable.

// Temporal / aggregation queries ("what's new", "top stories this week") don't
// map to semantic similarity — they want the most *recent* items by date.
const RECENCY_QUERY =
  /\b(recent(ly)?|latest|newest|last\s+week|this\s+week|past\s+(week|few\s+days|days)|lately|today|yesterday|what'?s\s+new|top\s+stories|trending|round-?up|catch\s+me\s+up)\b/i;

/** Whether a query is asking for recent/latest items rather than about content. */
export function isRecencyQuery(text: string): boolean {
  return RECENCY_QUERY.test(text);
}
