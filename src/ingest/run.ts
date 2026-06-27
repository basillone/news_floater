import { eq } from "drizzle-orm";

import { ingestionRuns } from "@/db/schema";
import type { SourceAdapter, SourceName, FetchOptions } from "./types";
import { upsertItems, type Database } from "./upsert";

export interface IngestResult {
  source: SourceName;
  status: "ok" | "failed";
  seen: number;
  upserted: number;
  error?: string;
}

/**
 * Ingest a single source, recording the run in `ingestion_runs`. Failures are
 * caught and logged (not thrown) so a multi-source run isn't killed by one bad
 * source — the result carries the status instead.
 */
export async function ingestSource(
  db: Database,
  adapter: SourceAdapter,
  opts?: FetchOptions,
): Promise<IngestResult> {
  const [run] = await db
    .insert(ingestionRuns)
    .values({ source: adapter.name })
    .returning({ id: ingestionRuns.id });

  try {
    const fetched = await adapter.fetchRecent(opts);
    const { seen, upserted } = await upsertItems(db, fetched);
    await db
      .update(ingestionRuns)
      .set({ finishedAt: new Date(), itemsSeen: seen, itemsUpserted: upserted, status: "ok" })
      .where(eq(ingestionRuns.id, run.id));
    return { source: adapter.name, status: "ok", seen, upserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(ingestionRuns)
      .set({ finishedAt: new Date(), status: "failed", error: message })
      .where(eq(ingestionRuns.id, run.id));
    return { source: adapter.name, status: "failed", seen: 0, upserted: 0, error: message };
  }
}

/** Run several sources, isolating each one's failures. */
export async function ingestAll(
  db: Database,
  adapters: SourceAdapter[],
  opts?: FetchOptions,
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const adapter of adapters) {
    results.push(await ingestSource(db, adapter, opts));
  }
  return results;
}
