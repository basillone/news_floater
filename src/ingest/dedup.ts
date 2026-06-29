import type { RawItem } from "./types";

const ARXIV_HOST = /(^|\.)arxiv\.org$/;

/** "2401.12345v2" -> "2401.12345" (also tolerates ids with no version). */
export function stripArxivVersion(id: string): string {
  return id.replace(/v\d+$/, "");
}

/**
 * Version-stripped arXiv id from an abs/pdf URL, or null if the URL isn't arXiv.
 * Handles "/abs/2401.12345v2", "/pdf/2401.12345", "/pdf/2401.12345v2.pdf".
 */
export function extractArxivId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!ARXIV_HOST.test(u.hostname.toLowerCase())) return null;
  const match = u.pathname.match(/\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?$/);
  return match ? match[1] : null;
}

/**
 * Cross-source identity. arXiv items key on their version-stripped id; items
 * from other sources key on the arXiv paper they link to (if any). Returns null
 * when there's no confident cross-source identity — those stay their own work.
 * The `arxiv:` namespace leaves room for other key kinds later.
 */
export function deriveDedupKey(item: RawItem): string | null {
  if (item.source === "arxiv") {
    return `arxiv:${stripArxivVersion(item.externalId)}`;
  }
  const arxivId = extractArxivId(item.url);
  return arxivId ? `arxiv:${arxivId}` : null;
}
