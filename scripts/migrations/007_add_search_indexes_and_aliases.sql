BEGIN;

-- Enable trigram support for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Alias tables for better entity linking
CREATE TABLE IF NOT EXISTS source_alias (
  id         bigserial PRIMARY KEY,
  source_id  integer NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  alias      text NOT NULL,
  normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS narrator_alias (
  id          bigserial PRIMARY KEY,
  narrator_id integer NOT NULL REFERENCES narrator(id) ON DELETE CASCADE,
  alias       text NOT NULL,
  normalized  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS source_alias_unique
  ON source_alias (source_id, normalized);

CREATE UNIQUE INDEX IF NOT EXISTS narrator_alias_unique
  ON narrator_alias (narrator_id, normalized);

CREATE INDEX IF NOT EXISTS source_alias_trgm
  ON source_alias USING GIN (alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS narrator_alias_trgm
  ON narrator_alias USING GIN (alias gin_trgm_ops);

-- Generated tsvector columns for FTS
ALTER TABLE matn
  ADD COLUMN IF NOT EXISTS matn_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(text_en, '') || ' ' || coalesce(summary, ''))
  ) STORED;

ALTER TABLE source
  ADD COLUMN IF NOT EXISTS source_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, ''))
  ) STORED;

ALTER TABLE book
  ADD COLUMN IF NOT EXISTS book_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, ''))
  ) STORED;

ALTER TABLE chapter
  ADD COLUMN IF NOT EXISTS chapter_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, ''))
  ) STORED;

ALTER TABLE narrator
  ADD COLUMN IF NOT EXISTS narrator_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(descriptor, ''))
  ) STORED;

ALTER TABLE tag
  ADD COLUMN IF NOT EXISTS tag_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, ''))
  ) STORED;

ALTER TABLE grade
  ADD COLUMN IF NOT EXISTS grade_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

ALTER TABLE scholar
  ADD COLUMN IF NOT EXISTS scholar_search tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(lifespan_label, ''))
  ) STORED;

-- FTS indexes
CREATE INDEX IF NOT EXISTS matn_search_gin ON matn USING GIN (matn_search);
CREATE INDEX IF NOT EXISTS source_search_gin ON source USING GIN (source_search);
CREATE INDEX IF NOT EXISTS book_search_gin ON book USING GIN (book_search);
CREATE INDEX IF NOT EXISTS chapter_search_gin ON chapter USING GIN (chapter_search);
CREATE INDEX IF NOT EXISTS narrator_search_gin ON narrator USING GIN (narrator_search);
CREATE INDEX IF NOT EXISTS tag_search_gin ON tag USING GIN (tag_search);
CREATE INDEX IF NOT EXISTS grade_search_gin ON grade USING GIN (grade_search);
CREATE INDEX IF NOT EXISTS scholar_search_gin ON scholar USING GIN (scholar_search);

-- Trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS source_name_trgm ON source USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS narrator_name_trgm ON narrator USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS tag_name_trgm ON tag USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS grade_name_trgm ON grade USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS scholar_name_trgm ON scholar USING GIN (name gin_trgm_ops);

-- Extend RAG logs for retrieval diagnostics
ALTER TABLE rag_logs
  ADD COLUMN IF NOT EXISTS retrieval_mode text,
  ADD COLUMN IF NOT EXISTS retrieval_scores jsonb,
  ADD COLUMN IF NOT EXISTS seed_ids integer[],
  ADD COLUMN IF NOT EXISTS kg_coverage jsonb;

-- updated_at triggers for alias tables (function already exists)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['source_alias','narrator_alias']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I_set_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION set_updated_at_timestamp();',
      tbl, tbl
    );
  END LOOP;
END $$;

COMMIT;
