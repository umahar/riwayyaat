BEGIN;

-- 1) Scholars catalog (one row per rater/critic).
CREATE TABLE IF NOT EXISTS scholar (
  id serial PRIMARY KEY,
  name text NOT NULL,
  lifespan_label text,
  notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS scholar_unique_name_lifespan ON scholar (name, lifespan_label);
CREATE INDEX IF NOT EXISTS scholar_index_name ON scholar (name);

-- 2) Per-hadith grades with scholar attribution.
CREATE TABLE IF NOT EXISTS hadith_grade (
  id serial PRIMARY KEY,
  hadith_id integer NOT NULL REFERENCES hadith(id) ON DELETE CASCADE,
  grade_id integer NOT NULL REFERENCES grade(id),
  scholar_id integer NOT NULL REFERENCES scholar(id),
  notes text,
  is_primary boolean NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS hadith_grade_unique_hadith_scholar ON hadith_grade (hadith_id, scholar_id);
CREATE INDEX IF NOT EXISTS hadith_grade_index_hadith ON hadith_grade (hadith_id);

-- 3) Backfill scholars from existing source authors (best available proxy).
INSERT INTO scholar (name, lifespan_label)
SELECT DISTINCT a.name, a.lifespan_label
FROM author a
JOIN source s ON s.author_id = a.id
ON CONFLICT (name, lifespan_label) DO NOTHING;

-- 4) Backfill hadith_grade from legacy hadith.grade_id + source author.
INSERT INTO hadith_grade (hadith_id, grade_id, scholar_id, is_primary)
SELECT h.id, h.grade_id, sc.id, TRUE
FROM hadith h
JOIN source s ON s.id = h.source_id
JOIN author a ON a.id = s.author_id
JOIN scholar sc ON sc.name = a.name AND COALESCE(sc.lifespan_label, '') = COALESCE(a.lifespan_label, '')
WHERE h.grade_id IS NOT NULL
ON CONFLICT (hadith_id, scholar_id)
  DO UPDATE SET grade_id = EXCLUDED.grade_id, is_primary = TRUE;

-- Keep a single primary flag per hadith for the legacy badge.
WITH ranked AS (
  SELECT id, hadith_id, ROW_NUMBER() OVER (PARTITION BY hadith_id ORDER BY is_primary DESC, id) AS rn
  FROM hadith_grade
)
UPDATE hadith_grade hg
SET is_primary = ranked.rn = 1
FROM ranked
WHERE hg.id = ranked.id;

COMMIT;
