# Schema & Migrations

Postgres is the source of truth for hadith/matn, chains, lookups, and AI metadata. Neo4j and pgvector are projections derived from this schema.

## Migration order

Run the SQL files in `scripts/migrations` sequentially:

1. `001_add_scholars_and_hadith_grades.sql` — base grader tables.
2. `002_drop_hadith_grade_id.sql` — normalization clean-up.
3. `003_add_hadith_display_number_and_identifiers.sql` — display labels + identifiers.
4. `004_add_hadith_soft_delete_and_tags.sql` — soft delete + tag tables.
5. `005_add_pgvector_and_rag_tables.sql` — `hadith_embedding`, `rag_logs`, `updated_at` + triggers (enables `vector` extension, adds 1536-dim constraint).
6. `006_delta_sync_queue.sql` — `hadith_sync_queue` for per-hadith graph/embedding refresh.
7. `007_add_search_indexes_and_aliases.sql` — FTS + trigram indexes, alias tables for entity linking, extended `rag_logs`.

Example:

```bash
psql "$DATABASE_URL" -f scripts/migrations/001_add_scholars_and_hadith_grades.sql
# ...
psql "$DATABASE_URL" -f scripts/migrations/006_delta_sync_queue.sql
psql "$DATABASE_URL" -f scripts/migrations/007_add_search_indexes_and_aliases.sql
```

## Core tables (high level)

- **hadith**: links to `matn`, `source/book/chapter`, `display_number`, `location`, `deleted_at` for soft deletes, `updated_at` trigger.
- **matn**: `text_en`, optional `text_ar`/`summary`.
- **hadith_chain**: one or more chains per hadith; links to narration/chain/attribution types, `is_primary`, optional `label`.
- **chain_narrator**: ordered isnād steps with roles, classification/reliability/tarīq (`transmission_method_id`).
- **lookups**: narration levels, chain/attribution types, transmission methods, reliability tiers, narrator tiers, tags, grades, scholars, identifiers.
- **hadith_grade**: per-hadith grades with scholar attribution and `is_primary`.
- **hadith_identifier**: scheme-aware identifiers (`scheme_key`, `identifier`, `is_primary`, `notes`).
- **hadith_tag**: simple many-to-many join.

Numbering model:

- `hadith.id` is the stable key; `hadith.number` is legacy/internal.
- `hadith.display_number` is the human-facing label (e.g., `45a`, `Vol. 2 #5`), surfaced as `details.displayNumber`.
- `display_label` is shown in graph nodes and defaults to `Book {book}, Hadith {number}` if no custom label is set.

## AI + sync tables

- **hadith_embedding**: pgvector storage for matn embeddings (`{hadith_id, model, embedding}`; unique per model). Rebuilt via `npm run rag:backfill` or per-hadith during delta sync.
- **rag_logs**: audit of `/api/rag/query` requests (question, filters, retrieved ids, model/tokens, response, citations).
- **hadith_sync_queue**: pending work items with `needs_graph`/`needs_embedding`. Admin create/update/delete enqueues; processed by `npm run sync:delta` or `/api/admin/sync/delta`.

## Projection notes

- Neo4j nodes store `pgId` + `key` (e.g., `Hadith:123`) for stable MERGE operations. `scripts/graph-sync.ts` clears and rebuilds the graph from Postgres; `processHadithSyncBatch` refreshes a single hadith.
- pgvector queries use cosine distance over `hadith_embedding.embedding`. `src/server/rag/retriever.ts` embeds the user question with the same model (`EMBEDDING_MODEL`, default `text-embedding-3-small`).
