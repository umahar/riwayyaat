BEGIN;

-- Insert book tags
INSERT INTO tag (name)
SELECT DISTINCT b.name
FROM book b
WHERE b.name IS NOT NULL AND b.name <> ''
ON CONFLICT (name) DO NOTHING;

-- Link untagged hadiths to book tags
INSERT INTO hadith_tag (hadith_id, tag_id)
SELECT h.id, t.id
FROM hadith h
JOIN book b ON b.id = h.book_id
JOIN tag t ON t.name = b.name
WHERE h.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM hadith_tag ht WHERE ht.hadith_id = h.id)
ON CONFLICT (hadith_id, tag_id) DO NOTHING;

-- Insert source tags
INSERT INTO tag (name)
SELECT DISTINCT s.name
FROM source s
WHERE s.name IS NOT NULL AND s.name <> ''
ON CONFLICT (name) DO NOTHING;

-- Link remaining untagged hadiths to source tags
INSERT INTO hadith_tag (hadith_id, tag_id)
SELECT h.id, t.id
FROM hadith h
JOIN source s ON s.id = h.source_id
JOIN tag t ON t.name = s.name
WHERE h.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM hadith_tag ht WHERE ht.hadith_id = h.id)
ON CONFLICT (hadith_id, tag_id) DO NOTHING;

COMMIT;
