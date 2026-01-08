BEGIN;

-- Speed up matn similarity searches (pg_trgm extension is enabled in 007).
CREATE INDEX IF NOT EXISTS matn_text_en_trgm
  ON matn USING GIN (text_en gin_trgm_ops);

COMMIT;
