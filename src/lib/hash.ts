import { createHash } from "node:crypto";

/**
 * Stable content hash used to skip re-embedding unchanged text. The same input
 * always yields the same hash; any change yields a different one.
 */
export function contentHash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
