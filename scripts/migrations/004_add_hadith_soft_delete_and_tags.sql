BEGIN;

-- 1) Soft-delete support on hadith.
ALTER TABLE hadith
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS hadith_index_deleted_at ON hadith (deleted_at);

-- 2) Tagging support for flexible filtering.
CREATE TABLE IF NOT EXISTS tag (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS hadith_tag (
  hadith_id integer NOT NULL REFERENCES hadith(id) ON DELETE CASCADE,
  tag_id integer NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hadith_id, tag_id)
);

COMMIT;
