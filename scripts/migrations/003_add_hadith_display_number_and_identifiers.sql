BEGIN;

-- 1) Add a human-facing display label on hadith (nullable, keep legacy number intact).
ALTER TABLE hadith
  ADD COLUMN IF NOT EXISTS display_number text;

CREATE INDEX IF NOT EXISTS hadith_index_display_number ON hadith (display_number);

-- 2) Add a cross-scheme identifier table for flexible numbering/edition labels.
CREATE TABLE IF NOT EXISTS hadith_identifier (
  id serial PRIMARY KEY,
  hadith_id integer NOT NULL REFERENCES hadith(id) ON DELETE CASCADE,
  scheme_key text NOT NULL,
  identifier text NOT NULL,
  notes text,
  is_primary boolean NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS hadith_identifier_unique_hadith_scheme_identifier
  ON hadith_identifier (hadith_id, scheme_key, identifier);

-- Enforce a single primary identifier per hadith per scheme.
CREATE UNIQUE INDEX IF NOT EXISTS hadith_identifier_unique_primary_per_scheme
  ON hadith_identifier (hadith_id, scheme_key)
  WHERE is_primary = true;

-- Support lookups/search by scheme + identifier.
CREATE INDEX IF NOT EXISTS hadith_identifier_index_scheme_identifier
  ON hadith_identifier (scheme_key, identifier);

-- 3) Backfill display_number from the legacy integer number when missing.
UPDATE hadith
SET display_number = COALESCE(display_number, number::text);

-- 4) Seed legacy identifiers into the new table as the primary "legacy_source_number" scheme.
INSERT INTO hadith_identifier (hadith_id, scheme_key, identifier, is_primary)
SELECT h.id, 'legacy_source_number', h.number::text, true
FROM hadith h
ON CONFLICT (hadith_id, scheme_key, identifier)
  DO UPDATE SET is_primary = EXCLUDED.is_primary;

-- Normalize primaries (keep only one primary per hadith per scheme).
WITH ranked AS (
  SELECT
    id,
    hadith_id,
    scheme_key,
    ROW_NUMBER() OVER (PARTITION BY hadith_id, scheme_key ORDER BY is_primary DESC, id) AS rn
  FROM hadith_identifier
)
UPDATE hadith_identifier hi
SET is_primary = ranked.rn = 1
FROM ranked
WHERE hi.id = ranked.id;

COMMIT;
