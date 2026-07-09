# Design Decisions

This document records the architectural and tooling decisions behind this project, and — just as importantly — the alternatives I considered and chose _not_ to use. It's written for someone reading the codebase cold who wants to understand _why_ it looks the way it does.

## What this is, and the honest framing

An AI/ML research aggregator: it ingests content from arXiv (cs.CL, cs.AI, cs.LG) and Hacker News (with AI blogs as a follow-on), stores it in Postgres, generates embeddings, and exposes a feed, hybrid semantic search, and a grounded RAG chat over the corpus.

It serves two goals, and they pull in different directions:

1. **A tool I actually use** to stay current on AI research.
2. **A demonstration of production engineering judgment** — schema design, idempotent ingestion, cross-source deduplication, hybrid retrieval, and RAG with real grounding.

Being explicit about both matters, because the right engineering decision changes depending on which goal you optimize for. The section below is where that tension gets resolved out loud.

---

## Build vs. buy: why build this at all?

**A fair critique: most of the _consumption_ value here could be bought, not built.**

If the only goal were "help me stay on top of AI research," the faster and lower-maintenance solution is to wire up [Exa](https://exa.ai) (neural search over the web, with an API for search + content retrieval) or [Perplexity's Sonar API](https://docs.perplexity.ai) (a hosted answer-engine), point a daily cron at it, and email myself a digest. That's a weekend of work, it covers more of the web than a fixed source list, and there's no ingestion pipeline or stale corpus to maintain. As a _product_, building the full pipeline is reinventing wheels.

I built it anyway, deliberately, for reasons that only hold up once you separate the two goals:

- **As a portfolio piece**, wiring Exa + an LLM demonstrates "can integrate APIs" — true of nearly every candidate. Owning the pipeline demonstrates the skills the work actually exercises: schema design, idempotent ingestion, dedup across sources, hybrid retrieval, and grounded RAG. The build is justified by the _second_ goal even though it's over-engineered for the first.
- **Owning the corpus buys real things a search API doesn't:** a deterministic, curated scope with no general-web noise; provenance and dedup across sources (the same paper surfacing on arXiv and HN is collapsed into one item with both signals attached); cached summaries; no per-query API cost at read time; and full control over ranking.

**The strongest version is a hybrid, not either/or.** Exa is a natural fit for the _discovery_ half — finding relevant content beyond a fixed source list — while this project owns the storage, dedup, retrieval, and RAG layer on top. "Buy the commoditized web-search part, build the differentiated part" is the move I'd make if this were a production system with a budget; it's noted in [What's next](#whats-next) and the architecture leaves a seam for it.

The short version: I know I could have bought most of this. I built it on purpose, for stated reasons, and the alternative is documented rather than ignored.

---

## Tech stack decisions

| Area             | Choice                                                                 | Why                                                                                                                                                                                                                                                                                           | Considered                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js (App Router)                                                   | Server Components for the feed (fast, no client fetch boilerplate); idiomatic, current paradigm.                                                                                                                                                                                              | Pages Router (dated); SPA + separate API (more moving parts).                                                                                                                         |
| Hosting          | Vercel                                                                 | First-party Next.js host: zero-config deploys, per-PR preview deployments, cron, and first-party AI SDK integration. Ingestion is short and bursty, so serverless fits.                                                                                                                       | Fly (better for persistent workers/long jobs — which the architecture deliberately avoids; would add ops for no gain here).                                                           |
| Database         | Postgres (Neon)                                                        | Just-a-database fit: pgvector + scale-to-zero + instant branching (each preview deploy gets its own seeded DB branch). I don't need a full backend platform.                                                                                                                                  | Supabase (great if I needed auth/storage/realtime; more surface than this uses). Both are Postgres — low lock-in either way.                                                          |
| ORM / migrations | Drizzle ORM + drizzle-kit                                              | Typed schema-as-code that generates checked-in SQL migrations — reviewable migrations without click-ops, and types flow from the schema.                                                                                                                                                      | Raw SQL + a query lib (more manual); Prisma (heavier, less SQL-transparent).                                                                                                          |
| Vector store     | pgvector (in the same Postgres)                                        | One datastore, transactional consistency between items and embeddings, no extra service to operate. HNSW index for recall/latency.                                                                                                                                                            | Dedicated vector DB (Pinecone/Qdrant/Weaviate) — unjustified operational and cost overhead at this scale.                                                                             |
| Embeddings       | OpenAI `text-embedding-3-small`                                        | Cheap (cents for the whole backfill), good quality, zero ops.                                                                                                                                                                                                                                 | Self-hosted sentence-transformers / Ollama — I have the infra background to do it, but adding inference ops to a portfolio project is the opposite of the judgment I'm demonstrating. |
| Retrieval        | Hybrid: vector + Postgres full-text, fused with Reciprocal Rank Fusion | Pure semantic search is weak on exact tokens that dominate this domain (model names, acronyms like RLHF/MoE, author names). FTS is free in Postgres; RRF combines both rankings cheaply.                                                                                                      | Pure semantic (misses exact matches); managed search service (overkill). Re-ranking is deferred but seamed in.                                                                        |
| LLM              | OpenAI `gpt-4o-mini` for RAG chat                                      | **Single provider for embeddings AND chat.** Anthropic has no embedding model, so embeddings were always OpenAI/Voyage — using OpenAI for chat too means one key, one bill, one spend cap. A small model handles grounded RAG well. Behind a thin seam (`src/llm/chat.ts`) so it's swappable. | Claude for chat (a real option — its refusal/grounding is a strength — but a second vendor without a concrete need; the seam keeps it a one-line swap). Self-hosted (ops overhead).   |
| Chat UX          | Vercel AI SDK (`useChat`)                                              | Handles token streaming and in-flight states; idiomatic on Vercel. Streaming means no dead wait on multi-second responses.                                                                                                                                                                    | Hand-rolled SSE handling (more code, no benefit).                                                                                                                                     |

---

## Architecture decisions

### Ingestion: adapter pattern, and backfill split from incremental sync

Each source implements a common `SourceAdapter` interface and normalizes into a canonical `RawItem` shape. The rest of the pipeline never knows whether an item came from arXiv (Atom XML), HN (Algolia JSON), or an RSS feed. Adding a source is implementing one interface — nothing downstream changes.

**Backfill and incremental sync are deliberately separate concerns:**

- **Backfill** is a one-shot script run locally against the database. It can be slow and re-run safely; it never runs inside a serverless function (where it would hit timeouts).
- **Incremental sync** is the Vercel Cron job: small, fast, idempotent (upsert by `(source, external_id)`), pulling only recent items.

This split is the difference between a pipeline that survives in serverless and one that dies trying to backfill thousands of items inside a 10-second function.

### External data is untrusted: validated at the boundary

Every external API response (arXiv, HN, RSS) is parsed and validated with Zod before it enters the system. External payloads are never `any`-typed. Treating third-party data as suspicious input — and failing loudly when it doesn't match — is a deliberate choice, not an afterthought.

### Deduplication: a `documents` + `mentions` model

The same paper often appears on both arXiv and HN. Rather than store it twice, the schema separates the canonical work from its appearances:

- **`documents`** — the canonical paper/post (title, abstract, authors), carrying a normalized `dedup_key` (for arXiv, the version-stripped ID — `arxiv:2401.12345`; for an HN story, the arXiv ID extracted from its link when present).
- **`mentions`** — one row per source appearance, holding the per-source URL and signal (HN points/comments, arXiv categories), linked to its document.

Ingestion does **resolve-or-create**: an incoming item attaches to an existing document (matched by an existing mention, then by `dedup_key`) or creates a new one. A `canonical_source` precedence (arXiv > RSS > HN) decides whose content is canonical, so an HN mention never clobbers a real arXiv abstract. This makes dedup **order-independent** — HN-before-paper and paper-before-HN converge to the same single document with two mentions. URL normalization and dedup-key derivation are isolated, unit-tested pure functions — the unglamorous core of dedup and where bugs hide.

> Tradeoff: resolve-or-create is read-then-write, so it runs in a transaction. The Neon HTTP driver has no interactive transactions, so the serverless cron path will use the WebSocket driver (or careful statement ordering). A simpler single-table `dedup_key` + `ON CONFLICT` design was the considered alternative; the documents/mentions model was chosen for correctness and order-independence.

### Observability: an `ingestion_runs` table

Every sync logs a row: source, timing, items seen, documents/mentions written, status, and any error. One source failing never kills the whole run — failures are isolated per source. This is about being able to _operate_ the thing, not just build it.

### RAG: grounded, with citations and an explicit "I don't know"

Retrieval returns ranked candidates (so a re-ranker can slot in later). The chat prompt formats each chunk with its source metadata and an index, instructs the model to answer _only_ from context, and returns a structured `sources[]` array rendered as footnotes. The model is explicitly allowed to say "that's not in the corpus" — grounding behavior that prevents confident hallucination over my own data, which is the failure mode that makes RAG demos worse than useless.

---

## What I deliberately did _not_ build

Restraint is part of the judgment. None of these are oversights:

- **No dedicated vector database** — pgvector in the same Postgres is sufficient and simpler at this scale.
- **No `sources` table** — sources are a typed enum + const config. A table to "signal extensibility" would be premature abstraction for a fixed, small source list.
- **No self-hosted embeddings or inference** — cheap managed APIs remove ops risk that buys nothing here.
- **No re-ranking, no caching layer, no queue** — all seamed for later; none needed for v1.
- **No E2E test suite** — tests target the tricky pure functions (URL normalization, dedup keys, RRF fusion, chunking), not framework glue.

## Tools considered and rejected

The "why didn't you just use X" question, pre-empted. These are different _categories_ of tool, which is itself worth being precise about:

| Tool                                   | Category                 | Why not (here)                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pinecone**                           | Managed vector DB        | pgvector in the same Postgres is simpler at this scale: one datastore, transactional consistency between items and embeddings, and metadata `JOIN`s in a single query. Pinecone earns its keep at billions of vectors / high QPS, not thousands. Adding it would be over-provisioning. |
| **Qdrant / Weaviate**                  | Self-hostable vector DB  | The open-source middle ground if I outgrew pgvector but wanted to avoid Pinecone lock-in. Not needed at v1 scale.                                                                                                                                                                      |
| **LangChain**                          | Orchestration framework  | Heavy, leaky abstractions that _hide_ the retrieval mechanics this project exists to demonstrate. Hand-rolling chunk → embed → retrieve → fuse → prompt (~150 lines) shows the judgment instead of burying it.                                                                         |
| **LlamaIndex**                         | RAG framework            | Cleaner and more RAG-focused than LangChain, but the same argument holds at this scale — the plumbing is the part worth owning.                                                                                                                                                        |
| **Exa / Vectara / hosted file-search** | Managed RAG-as-a-service | The "buy the whole layer" option. Right for shipping product fast, wrong for a project meant to demonstrate building the layer. (Exa is still the best _discovery_ component — see [Build vs. buy](#build-vs-buy-why-build-this-at-all).)                                              |

The Vercel AI SDK _is_ used — it's the right level of framework: narrowly scoped to the generation/streaming layer without trying to own the retrieval stack.

## What's next

- **Exa for discovery** — use a neural web-search API to surface relevant content beyond the fixed source list, feeding the same ingestion/dedup/retrieval layer.
- **Re-ranking** — a cross-encoder or hosted reranker (Cohere/Voyage) over the hybrid candidate set.
- **A real worker** — if ingestion grew continuous (streaming, heavy crawls), move it off serverless cron to a dedicated worker (Fly/Railway). That's the point where the hosting tradeoff above flips.
- **Retrieval eval** — expand the small query/expected-hit set used to tune retrieval into a proper offline evaluation.
