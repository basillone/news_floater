import "./load-env";

import { closeDb, db } from "@/db/node";
import { ingestAll } from "@/ingest/run";
import { arxivAdapter } from "@/ingest/sources/arxiv";

async function main() {
  const limit = Number(process.env.BACKFILL_LIMIT ?? 100);
  console.log(`Backfill starting (limit=${limit} per source)...`);

  const results = await ingestAll(db, [arxivAdapter], { limit });

  for (const r of results) {
    if (r.status === "ok") {
      console.log(`  ${r.source}: seen ${r.seen}, wrote ${r.upserted}`);
    } else {
      console.error(`  ${r.source}: FAILED — ${r.error}`);
    }
  }

  await closeDb();
  process.exit(results.some((r) => r.status === "failed") ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
