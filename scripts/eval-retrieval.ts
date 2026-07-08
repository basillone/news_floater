import "./load-env";

import { EVAL_QUERIES } from "@/retrieval/eval-queries";
import { search, type SearchMode } from "@/retrieval/search";

const MODES: SearchMode[] = ["keyword", "semantic", "hybrid"];
const K = 10;

interface ModeStats {
  hitAt5: number;
  hitAt10: number;
  mrr: number;
}

async function evalMode(mode: SearchMode): Promise<ModeStats> {
  let hitAt5 = 0;
  let hitAt10 = 0;
  let mrrSum = 0;

  for (const q of EVAL_QUERIES) {
    const docs = await search(q.query, { mode, limit: K });
    const rank = docs.findIndex((d) => q.relevant.test(`${d.title} ${d.abstract ?? ""}`));
    if (rank >= 0) {
      if (rank < 5) hitAt5 += 1;
      hitAt10 += 1;
      mrrSum += 1 / (rank + 1);
    }
  }

  const n = EVAL_QUERIES.length;
  return { hitAt5: hitAt5 / n, hitAt10: hitAt10 / n, mrr: mrrSum / n };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

async function main() {
  console.log(`Retrieval eval over ${EVAL_QUERIES.length} queries (top ${K})\n`);
  console.log("mode      hit@5   hit@10   MRR");
  console.log("--------  ------  -------  -----");
  for (const mode of MODES) {
    const s = await evalMode(mode);
    console.log(
      `${mode.padEnd(8)}  ${pct(s.hitAt5).padStart(5)}  ${pct(s.hitAt10).padStart(6)}  ${s.mrr
        .toFixed(3)
        .padStart(5)}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
