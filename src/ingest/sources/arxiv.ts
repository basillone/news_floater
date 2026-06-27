import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { FetchOptions, RawItem, SourceAdapter } from "../types";

const ARXIV_API = "http://export.arxiv.org/api/query";
const CATEGORIES = ["cs.CL", "cs.AI", "cs.LG"] as const;
const DEFAULT_LIMIT = 100;

// --- External-data validation (the boundary) -------------------------------
// arXiv returns Atom XML. fast-xml-parser yields an *object* for a single child
// and an *array* for multiple, so every repeatable element is `T | T[]`.

const linkSchema = z.object({
  "@_href": z.string(),
  "@_rel": z.string().optional(),
  "@_type": z.string().optional(),
  "@_title": z.string().optional(),
});
const authorSchema = z.object({ name: z.coerce.string() });
const categorySchema = z.object({ "@_term": z.string() });

const entrySchema = z.object({
  id: z.string(),
  title: z.coerce.string(),
  summary: z.coerce.string().optional(),
  published: z.string().optional(),
  updated: z.string().optional(),
  author: z.union([authorSchema, z.array(authorSchema)]).optional(),
  link: z.union([linkSchema, z.array(linkSchema)]).optional(),
  category: z.union([categorySchema, z.array(categorySchema)]).optional(),
});
type ArxivEntry = z.infer<typeof entrySchema>;

const feedSchema = z.object({
  feed: z.object({
    entry: z.union([entrySchema, z.array(entrySchema)]).optional(),
  }),
});

// --- Helpers ---------------------------------------------------------------

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const normalizeWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();

/** "http://arxiv.org/abs/2401.12345v2" -> { externalId: "2401.12345v2", version: 2 } */
const parseArxivId = (idUrl: string): { externalId: string; version: number | null } => {
  const externalId = idUrl.replace(/^https?:\/\/arxiv\.org\/abs\//, "");
  const match = externalId.match(/v(\d+)$/);
  return { externalId, version: match ? Number(match[1]) : null };
};

function entryToRawItem(entry: ArxivEntry): RawItem {
  const { externalId, version } = parseArxivId(entry.id);
  const links = asArray(entry.link);
  const absLink = links.find((l) => l["@_rel"] === "alternate")?.["@_href"];
  const pdfLink = links.find((l) => l["@_type"] === "application/pdf" || l["@_title"] === "pdf")?.[
    "@_href"
  ];
  const categories = asArray(entry.category).map((c) => c["@_term"]);

  return {
    source: "arxiv",
    externalId,
    url: absLink ?? entry.id,
    title: normalizeWhitespace(entry.title),
    abstract: entry.summary ? normalizeWhitespace(entry.summary) : null,
    authors: asArray(entry.author).map((a) => a.name.trim()),
    publishedAt: entry.published ? new Date(entry.published) : null,
    rawMetadata: {
      version,
      pdfUrl: pdfLink ?? null,
      categories,
      updated: entry.updated ?? null,
    },
  };
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Pure: Atom XML string -> normalized RawItems. Validates the parsed structure
 * with Zod and throws loudly on anything unexpected. Exported for unit tests.
 */
export function parseArxivAtom(xml: string): RawItem[] {
  const parsed = feedSchema.parse(parser.parse(xml));
  return asArray(parsed.feed.entry).map(entryToRawItem);
}

function buildUrl(limit: number): string {
  const searchQuery = CATEGORIES.map((c) => `cat:${c}`).join("+OR+");
  const params = new URLSearchParams({
    search_query: searchQuery,
    sortBy: "submittedDate",
    sortOrder: "descending",
    start: "0",
    max_results: String(limit),
  });
  // URLSearchParams encodes "+" as "%2B"; arXiv wants literal "+" between terms.
  return `${ARXIV_API}?${params.toString().replace(/%2B/g, "+")}`;
}

export const arxivAdapter: SourceAdapter = {
  name: "arxiv",
  async fetchRecent(opts?: FetchOptions): Promise<RawItem[]> {
    const limit = opts?.limit ?? DEFAULT_LIMIT;
    const res = await fetch(buildUrl(limit), {
      headers: { "User-Agent": "news-floater/0.1 (research aggregator)" },
    });
    if (!res.ok) {
      throw new Error(`arXiv API returned ${res.status} ${res.statusText}`);
    }
    return parseArxivAtom(await res.text());
  },
};
