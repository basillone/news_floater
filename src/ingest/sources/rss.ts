import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

import type { FetchOptions, RawItem, SourceAdapter } from "../types";

interface FeedConfig {
  name: string;
  url: string;
}

// Verified to expose working RSS/Atom feeds (Anthropic does not, so it's omitted
// deliberately — see private-notes/phases/phase-7-rss-blogs.md).
export const RSS_FEEDS: FeedConfig[] = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml" },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml" },
  { name: "Simon Willison", url: "https://simonwillison.net/atom/everything/" },
];
const DEFAULT_LIMIT_PER_FEED = 20;

// --- Helpers ---------------------------------------------------------------

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const normalizeWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();

const stripHtml = (s: string): string =>
  normalizeWhitespace(
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(?:39|x27);/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " "),
  );

const cleanAbstract = (s?: string): string | null => {
  if (!s) return null;
  const t = stripHtml(s);
  return t.length > 0 ? t : null;
};

/** A tag value that may be a plain string or a `{ "#text": ... }` object. */
const textOf = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "object" && "#text" in v) return String((v as { "#text": unknown })["#text"]);
  return undefined;
};

// --- External-data validation (the boundary) -------------------------------

const rssItemSchema = z.object({
  title: z.coerce.string(),
  link: z.coerce.string().optional(),
  description: z.coerce.string().optional(),
  pubDate: z.string().optional(),
  guid: z.union([z.string(), z.object({ "#text": z.coerce.string() })]).optional(),
  "dc:creator": z.coerce.string().optional(),
});
type RssItem = z.infer<typeof rssItemSchema>;

const atomLinkSchema = z.object({ "@_href": z.string(), "@_rel": z.string().optional() });
const atomAuthorSchema = z.object({ name: z.coerce.string().optional() });
const atomEntrySchema = z.object({
  id: z.coerce.string(),
  title: z.coerce.string(),
  link: z.union([atomLinkSchema, z.array(atomLinkSchema)]).optional(),
  summary: z.union([z.string(), z.object({ "#text": z.coerce.string().optional() })]).optional(),
  content: z.union([z.string(), z.object({ "#text": z.coerce.string().optional() })]).optional(),
  published: z.string().optional(),
  updated: z.string().optional(),
  author: z.union([atomAuthorSchema, z.array(atomAuthorSchema)]).optional(),
});
type AtomEntry = z.infer<typeof atomEntrySchema>;

const rssFeedSchema = z.object({
  rss: z.object({
    channel: z.object({ item: z.union([rssItemSchema, z.array(rssItemSchema)]).optional() }),
  }),
});
const atomFeedSchema = z.object({
  feed: z.object({
    entry: z.union([atomEntrySchema, z.array(atomEntrySchema)]).optional(),
    author: z.union([atomAuthorSchema, z.array(atomAuthorSchema)]).optional(),
  }),
});

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

const guidToString = (guid: RssItem["guid"]): string | undefined =>
  guid === undefined ? undefined : typeof guid === "string" ? guid : guid["#text"];

function rssItemToRawItem(item: RssItem, feed: string): RawItem {
  const externalId = guidToString(item.guid) ?? item.link ?? item.title;
  return {
    source: "rss",
    externalId,
    url: item.link ?? externalId,
    title: normalizeWhitespace(item.title),
    abstract: cleanAbstract(item.description),
    authors: item["dc:creator"] ? [item["dc:creator"].trim()] : [],
    publishedAt: item.pubDate ? new Date(item.pubDate) : null,
    rawMetadata: { feed },
  };
}

function atomEntryToRawItem(entry: AtomEntry, feed: string, feedAuthor?: string): RawItem {
  const links = asArray(entry.link);
  const alt = links.find((l) => l["@_rel"] === "alternate") ?? links[0];
  const authors = asArray(entry.author)
    .map((a) => a.name?.trim())
    .filter((n): n is string => Boolean(n));
  const summary = textOf(entry.summary) ?? textOf(entry.content);

  return {
    source: "rss",
    externalId: entry.id,
    url: alt?.["@_href"] ?? entry.id,
    title: normalizeWhitespace(entry.title),
    abstract: cleanAbstract(summary),
    authors: authors.length > 0 ? authors : feedAuthor ? [feedAuthor] : [],
    publishedAt: entry.published
      ? new Date(entry.published)
      : entry.updated
        ? new Date(entry.updated)
        : null,
    rawMetadata: { feed },
  };
}

/**
 * Pure: an RSS 2.0 or Atom feed string -> normalized RawItems. Auto-detects the
 * format, validates with Zod, throws loudly on anything unrecognized. For tests.
 */
export function parseFeed(xml: string, feed: string): RawItem[] {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  if ("rss" in parsed) {
    const { rss } = rssFeedSchema.parse(parsed);
    return asArray(rss.channel.item).map((i) => rssItemToRawItem(i, feed));
  }
  if ("feed" in parsed) {
    const { feed: atom } = atomFeedSchema.parse(parsed);
    const feedAuthor = asArray(atom.author)
      .map((a) => a.name)
      .find((n): n is string => Boolean(n));
    return asArray(atom.entry).map((e) => atomEntryToRawItem(e, feed, feedAuthor));
  }
  throw new Error(`Unrecognized feed format for "${feed}"`);
}

export const rssAdapter: SourceAdapter = {
  name: "rss",
  async fetchRecent(opts?: FetchOptions): Promise<RawItem[]> {
    const perFeed = opts?.limit ?? DEFAULT_LIMIT_PER_FEED;
    const all: RawItem[] = [];

    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "news-floater/0.1 (research aggregator)" },
        });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const items = parseFeed(await res.text(), feed.name);
        all.push(...items.slice(0, perFeed));
      } catch (err) {
        // Per-feed isolation: one bad feed must not kill the whole RSS source.
        console.error(`RSS feed "${feed.name}" failed:`, err instanceof Error ? err.message : err);
      }
    }

    return all;
  },
};
