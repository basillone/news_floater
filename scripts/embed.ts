import "./load-env";

import { closeDb, db } from "@/db/node";
import { embedPending } from "@/embeddings/embed-pending";

async function main() {
  const force = process.argv.includes("--force");
  const { documentsEmbedded, chunksInserted } = await embedPending(db, { force });
  console.log(
    `embedded ${documentsEmbedded} document(s), inserted ${chunksInserted} chunk(s)${force ? " (--force)" : ""}`,
  );
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
