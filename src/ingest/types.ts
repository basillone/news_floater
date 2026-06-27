/**
 * The ingestion contracts. Every source normalizes into a `RawItem`, so nothing
 * downstream (upsert, dedup, embedding, retrieval) knows or cares which source an
 * item came from. Adding a source = implementing `SourceAdapter`.
 */

export type SourceName = "arxiv" | "hn" | "rss";

/**
 * Canonical, source-agnostic shape produced by every adapter. This is the
 * boundary between "messy external data" and "our domain". Adapters are
 * responsible for validating and mapping into this; everything after assumes it
 * is well-formed.
 */
export interface RawItem {
  source: SourceName;
  /** Stable identifier within the source. Drives `(source, external_id)` idempotency. */
  externalId: string;
  /** Canonical URL for the item. */
  url: string;
  title: string;
  /** Abstract / summary / lead text. Null when the source has none. */
  abstract: string | null;
  authors: string[];
  /** Publication time, or null if the source doesn't provide one. */
  publishedAt: Date | null;
  /** Source-specific extras kept verbatim (HN score, arXiv categories, pdf url, ...). */
  rawMetadata: Record<string, unknown>;
}

export interface FetchOptions {
  /** Max items to request from the source in this run. */
  limit?: number;
}

export interface SourceAdapter {
  readonly name: SourceName;
  /** Fetch the most recent items, normalized and validated into `RawItem`s. */
  fetchRecent(opts?: FetchOptions): Promise<RawItem[]>;
}
