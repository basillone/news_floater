const TRACKING_KEYS = new Set([
  "ref",
  "ref_src",
  "ref_url",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "spm",
  "source",
  "_hsenc",
  "_hsmi",
]);

const isTrackingParam = (key: string): boolean =>
  key.startsWith("utm_") || TRACKING_KEYS.has(key.toLowerCase());

/**
 * Canonicalize a URL for comparison/dedup: lowercase scheme + host, drop `www.`
 * and default ports, strip tracking params and fragments, sort remaining params,
 * and remove a trailing slash. Pure. Returns the input trimmed if it doesn't parse.
 */
export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim();
  }

  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";

  const kept = [...u.searchParams.entries()]
    .filter(([key]) => !isTrackingParam(key))
    .sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [key, value] of kept) u.searchParams.append(key, value);

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  return u.toString();
}
