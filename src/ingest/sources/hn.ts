import { z } from "zod";

import type { FetchOptions, RawItem, SourceAdapter } from "../types";

const HN_API = "https://hn.algolia.com/api/v1/search_by_date";
// HN has no "AI" tag, so we query a curated keyword set and merge. "arxiv" is
// included deliberately — it surfaces stories that link papers (good for dedup).
const QUERIES = ["LLM", "GPT", "machine learning", "transformer", "diffusion", "arxiv"];
const DEFAULT_LIMIT = 100;
const HITS_PER_QUERY = 30;

const itemUrl = (objectId: string) => `https://news.ycombinator.com/item?id=${objectId}`;

const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

// --- External-data validation (the boundary) -------------------------------

const hitSchema = z.object({
  objectID: z.string(),
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  points: z.number().nullable().optional(),
  num_comments: z.number().nullable().optional(),
  created_at: z.string(),
  story_text: z.string().nullable().optional(),
});
type Hit = z.infer<typeof hitSchema>;

const responseSchema = z.object({ hits: z.array(hitSchema) });

function hitToRawItem(hit: Hit): RawItem {
  return {
    source: "hn",
    externalId: hit.objectID,
    // Ask HN / text posts have no external url -> fall back to the HN page.
    url: hit.url ?? itemUrl(hit.objectID),
    title: hit.title?.trim() ?? "(untitled)",
    abstract: hit.story_text ? stripHtml(hit.story_text) : null,
    authors: hit.author ? [hit.author] : [],
    publishedAt: new Date(hit.created_at),
    rawMetadata: {
      points: hit.points ?? 0,
      numComments: hit.num_comments ?? 0,
      hnUrl: itemUrl(hit.objectID),
      originalUrl: hit.url ?? null,
    },
  };
}

/** Pure: a parsed Algolia response -> RawItems. Validates and maps. For tests. */
export function parseHnSearch(payload: unknown): RawItem[] {
  return responseSchema.parse(payload).hits.map(hitToRawItem);
}

function dedupeByExternalId(items: RawItem[]): RawItem[] {
  const byId = new Map<string, RawItem>();
  for (const item of items) byId.set(item.externalId, item);
  return [...byId.values()];
}

export const hnAdapter: SourceAdapter = {
  name: "hn",
  async fetchRecent(opts?: FetchOptions): Promise<RawItem[]> {
    const limit = opts?.limit ?? DEFAULT_LIMIT;
    const all: RawItem[] = [];
    for (const query of QUERIES) {
      const params = new URLSearchParams({
        query,
        tags: "story",
        hitsPerPage: String(HITS_PER_QUERY),
      });
      const res = await fetch(`${HN_API}?${params.toString()}`, {
        headers: { "User-Agent": "news-floater/0.1 (research aggregator)" },
      });
      if (!res.ok) {
        throw new Error(`HN API returned ${res.status} ${res.statusText} for query "${query}"`);
      }
      all.push(...parseHnSearch(await res.json()));
    }
    return dedupeByExternalId(all).slice(0, limit);
  },
};
