BEGIN;

-- Create tags from chapter names (English) when tags are empty.
INSERT INTO tag (name)
SELECT DISTINCT c.name
FROM chapter c
WHERE c.name IS NOT NULL AND c.name <> ''
ON CONFLICT (name) DO NOTHING;

-- Link hadiths to chapter-based tags.
INSERT INTO hadith_tag (hadith_id, tag_id)
SELECT h.id, t.id
FROM hadith h
JOIN chapter c ON c.id = h.chapter_id
JOIN tag t ON t.name = c.name
WHERE h.deleted_at IS NULL
ON CONFLICT (hadith_id, tag_id) DO NOTHING;

COMMIT;
