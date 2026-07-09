# News Floater

### Deployed link: [news-floater.vercel.app](https://news-floater.vercel.app/)

An AI/ML research aggregator. It ingests papers and posts from multiple sources, deduplicates
them across sources, and serves a browsable feed, hybrid semantic search, and grounded
retrieval-augmented chat over the corpus.

> **Status: work in progress.** Foundations are in place (schema, migrations, DB clients,
> tooling). Ingestion, retrieval, and the UI are being built out. See the roadmap below.

### Sources (content that informs the platform):

- **arXiv** — cs.CL, cs.AI, and cs.LG (Atom API)
- **Hacker News** — AI/ML stories (Algolia API)
- **Anthropic blog** (RSS)
- **OpenAI blog** (RSS)
- **Google DeepMind blog** (RSS)
- **Simon Willison's blog** (RSS)

## What it does

- **Ingests** from arXiv (cs.CL, cs.AI, cs.LG) and Hacker News, with AI blogs (RSS) to follow.
- **Deduplicates** across sources — the same paper surfacing on arXiv and HN becomes one item
  carrying both signals.
- **Search** is hybrid: vector similarity (pgvector) fused with Postgres full-text search via
  Reciprocal Rank Fusion, so exact tokens (model names, acronyms) and semantic matches both work.
- **Chat** is grounded RAG with citations — answers come only from the corpus, with an explicit
  "not in the corpus" path.

## Stack

- **Next.js 16** (App Router) + **TypeScript** (strict)
- **Neon** Postgres + **pgvector**, via **Drizzle ORM** (typed schema, checked-in SQL migrations)
- **OpenAI** `text-embedding-3-small` for embeddings
- **Anthropic Claude** (Haiku for summaries, Sonnet for chat) via the Vercel **AI SDK**
- Deployed on **Vercel** (cron-driven incremental ingestion)

Design decisions and the alternatives considered are documented in [DECISIONS.md](DECISIONS.md).

## Local setup

Requires Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:migrate              # apply migrations to your Neon database
pnpm dev                     # http://localhost:3000
```

`.env.local` needs a Neon database (pooled + direct connection strings), an OpenAI key, an
Anthropic key, and a `CRON_SECRET`. See [.env.example](.env.example) for the full list.

## Scripts

| Command            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Start the dev server                         |
| `pnpm build`       | Production build                             |
| `pnpm typecheck`   | `tsc --noEmit`                               |
| `pnpm test`        | Run Vitest                                   |
| `pnpm lint`        | ESLint                                       |
| `pnpm format`      | Prettier write (`format:check` to verify)    |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate`  | Apply migrations                             |
| `pnpm db:studio`   | Drizzle Studio                               |

## Roadmap

1. ✅ Foundations — schema, migrations, DB clients, tooling
2. ⏳ Ingestion — arXiv + Hacker News adapters, idempotent upserts, cross-source dedup
3. Retrieval — embeddings + hybrid search (pgvector + FTS + RRF)
4. Scheduled sync + deploy
5. Feed + search UI
6. RAG chat with citations
