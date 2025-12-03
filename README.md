## Riwayyaat (A project by UA)

Graph-native workspace for studying hadith: isnād visualizations (Neo4j), RAG answers with citations (pgvector + OpenAI), and an admin console powered by Postgres. Built with Next.js 16, React 19, and Tailwind v4.

### What's inside

- **Next.js App Router** + TypeScript with `@/*` aliases.
- **Postgres** schema for hadith/matn/chains + lookup tables, pgvector embeddings, and a delta sync queue.
- **Neo4j** projection with APIs for isnād graphs, narrator networks, and variants.
- **RAG pipeline** (OpenAI embeddings + chat) exposed via `/api/rag/query`; logs saved to `rag_logs`.
- **Admin console** under `/admin/*` with guarded `/api/admin/*` routes that enqueue sync jobs.

### Setup

1. Copy envs: `cp .env.example .env.local` and fill PG, OpenAI, and Neo4j values.
2. Install deps: `npm install`.
3. Run Postgres migrations in order: `psql "$DATABASE_URL" -f scripts/migrations/001_add_scholars_and_hadith_grades.sql` … up to `006_delta_sync_queue.sql` (pgvector is enabled in `005_*`).
4. Seed demo data (idempotent): `npx tsx scripts/seed-hadith.ts`.
5. Start dev server: `npm run dev` (http://localhost:3000). Lint with `npm run lint`.

### Databases & services

- **Postgres**: core schema + `hadith_embedding`, `rag_logs`, `hadith_sync_queue`. See `docs/SCHEMA.md` for table notes. DB helpers live in `src/server/db/*`.
- **Neo4j**: set `NEO4J_URI/USER/PASSWORD`. Full rebuild: `npm run graph:sync`. Delta refresh per hadith: `npm run sync:delta` or POST `/api/admin/sync/delta` (admin token required).
- **OpenAI**: set `OPENAI_API_KEY` (optional `EMBEDDING_MODEL`, `RAG_LLM_MODEL`). Backfill missing embeddings: `npm run rag:backfill`.
- **Scripts** (all `npx tsx <script>`):
  - `scripts/check-db.ts`, `list-tables.ts`, `show-narration-levels.ts` — quick introspection.
  - `scripts/seed-hadith.ts` — load demo dataset.
  - `scripts/test-numbering.ts` — validate display numbers/identifiers.
  - `scripts/hadith-sync-process.ts` — process pending graph/embedding jobs.
  - `scripts/run-evaluation.ts` — replay the evaluation set and recompute KG + retrieval + faithfulness metrics (mirrors the `/admin/eval` dashboard).

### UI/feature notes

- Splash → workspace with chat, sidebar filters, and hadith detail panel.
- Conversation panel streams answers + clickable citations (jump focuses the hadith).
- Details panel has tabs for metadata and graph views (isnād, variants, narrator network).
- Footer + header carry safety disclaimers; tool is for study only.

### Docs

- `docs/ARCHITECTURE.md` — system overview, RAG + graph flows, key commands.
- `docs/SCHEMA.md` — migration order and schema notes (embeddings, sync queue, audit log).
- `docs/EVALUATION.md` — how to define the evaluation dataset, run it from CLI/admin, and interpret the metrics for demos.
