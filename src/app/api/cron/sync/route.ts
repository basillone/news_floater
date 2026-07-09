import { NextResponse } from "next/server";

import { createServerlessDb } from "@/db/serverless";
import { embedPending } from "@/embeddings/embed-pending";
import { env } from "@/env";
import { ingestAll } from "@/ingest/run";
import { arxivAdapter } from "@/ingest/sources/arxiv";
import { hnAdapter } from "@/ingest/sources/hn";
import { rssAdapter } from "@/ingest/sources/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Small, bounded pull — this runs in seconds (shape (a)). Never a backfill.
const SYNC_LIMIT = 30;

/**
 * Scheduled incremental sync. Vercel Cron attaches `Authorization: Bearer
 * <CRON_SECRET>` automatically, so real cron passes and other callers get 401.
 * Ingests recent items (transactional resolve via the WebSocket client) then
 * embeds any new documents. Idempotent — safe to re-run or overlap.
 */
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { db, close } = createServerlessDb();
  try {
    const ingest = await ingestAll(db, [arxivAdapter, hnAdapter, rssAdapter], {
      limit: SYNC_LIMIT,
    });
    const embedded = await embedPending(db);
    return NextResponse.json({ ok: true, ingest, embedded });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await close();
  }
}
