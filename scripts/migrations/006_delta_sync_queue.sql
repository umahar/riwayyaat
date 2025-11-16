BEGIN;

CREATE TABLE IF NOT EXISTS hadith_sync_queue (
  id bigserial PRIMARY KEY,
  hadith_id integer NOT NULL REFERENCES hadith(id) ON DELETE CASCADE,
  needs_graph boolean NOT NULL DEFAULT true,
  needs_embedding boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- prevent duplicate pending entries per hadith
CREATE UNIQUE INDEX IF NOT EXISTS hadith_sync_queue_unique_pending
  ON hadith_sync_queue (hadith_id)
  WHERE needs_graph = true OR needs_embedding = true;

COMMIT;
