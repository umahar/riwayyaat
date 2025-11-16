BEGIN;

-- Enable pgvector for embeddings (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Hadith embeddings: one row per hadith per model.
-- Update the dimension to match your embedding model (e.g., 1536 for text-embedding-3-small).
CREATE TABLE IF NOT EXISTS hadith_embedding (
  id          bigserial PRIMARY KEY,
  hadith_id   integer NOT NULL REFERENCES hadith(id) ON DELETE CASCADE,
  model       text    NOT NULL,
  embedding   vector  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE hadith_embedding
  ADD CONSTRAINT hadith_embedding_model_dim CHECK (vector_dims(embedding) = 1536);

CREATE UNIQUE INDEX IF NOT EXISTS hadith_embedding_unique_hadith_model
  ON hadith_embedding (hadith_id, model);

-- Optional ANN index (tune lists for your data size; requires ANALYZE before use).
-- CREATE INDEX IF NOT EXISTS hadith_embedding_ivfflat_cosine
--   ON hadith_embedding USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RAG request/response audit log
CREATE TABLE IF NOT EXISTS rag_logs (
  id                bigserial PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  question          text        NOT NULL,
  filters           jsonb,
  retrieved_ids     integer[],
  model             text,
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  response          text,
  citations         jsonb
);

-- updated_at support for delta sync jobs
ALTER TABLE author            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE source            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE book              ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE chapter           ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE matn              ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hadith            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hadith_chain      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE chain_narrator    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hadith_grade      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hadith_identifier ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tag               ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE hadith_tag        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger to bump updated_at on UPDATE across tables
CREATE OR REPLACE FUNCTION set_updated_at_timestamp() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'author','source','book','chapter','matn','hadith','hadith_chain',
    'chain_narrator','hadith_grade','hadith_identifier','tag','hadith_tag'
  ]
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
