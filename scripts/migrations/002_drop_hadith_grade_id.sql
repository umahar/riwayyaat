BEGIN;

-- Ensure prerequisite tables exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'hadith_grade'
  ) THEN
    RAISE EXCEPTION 'hadith_grade table is required before dropping hadith.grade_id';
  END IF;
END $$;

-- Backfill any missing hadith_grade rows from legacy hadith.grade_id before dropping the column.
INSERT INTO hadith_grade (hadith_id, grade_id, scholar_id, is_primary)
SELECT h.id, h.grade_id, sc.id, TRUE
FROM hadith h
JOIN source s ON s.id = h.source_id
JOIN author a ON a.id = s.author_id
JOIN scholar sc ON sc.name = a.name AND COALESCE(sc.lifespan_label, '') = COALESCE(a.lifespan_label, '')
WHERE h.grade_id IS NOT NULL
ON CONFLICT (hadith_id, scholar_id)
  DO UPDATE SET grade_id = EXCLUDED.grade_id, is_primary = TRUE;

-- Keep a single primary flag per hadith.
WITH ranked AS (
  SELECT id, hadith_id, ROW_NUMBER() OVER (PARTITION BY hadith_id ORDER BY is_primary DESC, id) AS rn
  FROM hadith_grade
)
UPDATE hadith_grade hg
SET is_primary = ranked.rn = 1
FROM ranked
WHERE hg.id = ranked.id
  AND hg.hadith_id = ranked.hadith_id;

-- Drop legacy column and constraints if present.
ALTER TABLE hadith DROP CONSTRAINT IF EXISTS fk_hadith_grade;
ALTER TABLE hadith DROP CONSTRAINT IF EXISTS hadith_grade_id_fkey;
ALTER TABLE hadith DROP COLUMN IF EXISTS grade_id;

COMMIT;
