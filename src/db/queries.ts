import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { documents, mentions } from "@/db/schema";
import type { SourceName } from "@/ingest/types";

// Display shapes for the UI — deliberately omit internals (embedding, tsvector,
// content_hash) and flatten the bits the cards actually render.

export interface MentionView {
  source: SourceName;
  url: string;
  points: number | null;
  hnUrl: string | null;
}

export interface DocumentView {
  id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  publishedAt: Date | null;
  canonicalSource: SourceName;
  /** Primary link — the canonical source's mention url. */
  url: string;
  mentions: MentionView[];
}

const DOC_FIELDS = {
  id: documents.id,
  title: documents.title,
  abstract: documents.abstract,
  authors: documents.authors,
  publishedAt: documents.publishedAt,
  canonicalSource: documents.canonicalSource,
};

type DocRow = {
  id: string;
  title: string;
  abstract: string | null;
  authors: string[] | null;
  publishedAt: Date | null;
  canonicalSource: SourceName;
};

function toMentionView(m: {
  source: SourceName;
  url: string;
  sourceMetadata: unknown;
}): MentionView {
  const meta = (m.sourceMetadata ?? {}) as Record<string, unknown>;
  return {
    source: m.source,
    url: m.url,
    points: typeof meta.points === "number" ? meta.points : null,
    hnUrl: typeof meta.hnUrl === "string" ? meta.hnUrl : null,
  };
}

/** Fetch each document's mentions and assemble the display view. */
async function attachMentions(docs: DocRow[]): Promise<DocumentView[]> {
  if (docs.length === 0) return [];
  const ids = docs.map((d) => d.id);
  const rows = await db
    .select({
      documentId: mentions.documentId,
      source: mentions.source,
      url: mentions.url,
      sourceMetadata: mentions.sourceMetadata,
    })
    .from(mentions)
    .where(inArray(mentions.documentId, ids));

  const byDoc = new Map<string, MentionView[]>();
  for (const row of rows) {
    const list = byDoc.get(row.documentId) ?? [];
    list.push(toMentionView(row));
    byDoc.set(row.documentId, list);
  }

  return docs.map((d) => {
    const views = byDoc.get(d.id) ?? [];
    const primary = views.find((m) => m.source === d.canonicalSource) ?? views[0];
    return {
      id: d.id,
      title: d.title,
      abstract: d.abstract,
      authors: d.authors ?? [],
      publishedAt: d.publishedAt,
      canonicalSource: d.canonicalSource,
      url: primary?.url ?? "#",
      mentions: views,
    };
  });
}

/** Most recent documents for the feed (newest published first, nulls last). */
export async function getRecentDocuments(limit = 30): Promise<DocumentView[]> {
  const docs = await db
    .select(DOC_FIELDS)
    .from(documents)
    .orderBy(sql`${documents.publishedAt} desc nulls last`)
    .limit(limit);
  return attachMentions(docs);
}

/** Hydrate documents by id, preserving the given order (for ranked search). */
export async function getDocumentsByIds(orderedIds: string[]): Promise<DocumentView[]> {
  if (orderedIds.length === 0) return [];
  const docs = await db.select(DOC_FIELDS).from(documents).where(inArray(documents.id, orderedIds));
  const views = await attachMentions(docs);
  const byId = new Map(views.map((v) => [v.id, v]));
  return orderedIds.map((id) => byId.get(id)).filter((v): v is DocumentView => v !== undefined);
}
