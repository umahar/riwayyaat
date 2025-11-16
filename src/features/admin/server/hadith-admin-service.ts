import { PoolClient } from "pg";
import { getClient } from "@/server/db/client";
import {
  AdminGradeInput,
  AdminHadithDetail,
  AdminHadithPayload,
  AdminHadithSummary,
  AdminIdentifierInput,
  AdminLookups,
  AdminNarratorInput,
  BookLookup,
  ChapterLookup,
  LookupOption,
} from "@/features/admin/types";

const MATN_PREVIEW = 140;
export class AdminInputError extends Error {
  statusCode = 400;
}

const normalizeId = (value?: number | null) => {
  if (value == null) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return numeric;
};

export type ListHadithOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  book?: string;
  chapter?: string;
  tag?: string;
  narrator?: string;
  source?: string;
};

export async function listAdminHadiths(
  options: ListHadithOptions = {},
): Promise<{ items: AdminHadithSummary[]; total: number }> {
  const page = Number.isFinite(options.page) && (options.page as number) > 0 ? Number(options.page) : 1;
  const pageSize =
    Number.isFinite(options.pageSize) && (options.pageSize as number) > 0 ? Number(options.pageSize) : 20;
  const offset = (page - 1) * pageSize;

  const params: unknown[] = [];
  const clauses: string[] = ["h.deleted_at IS NULL"];

  if (options.search) {
    params.push(`%${options.search}%`);
    const idx = params.length;
    clauses.push(`(m.text_en ILIKE $${idx} OR h.display_number ILIKE $${idx} OR s.name ILIKE $${idx})`);
  }

  if (options.book) {
    params.push(`%${options.book}%`);
    clauses.push(`b.name ILIKE $${params.length}`);
  }

  if (options.chapter) {
    params.push(`%${options.chapter}%`);
    clauses.push(`c.name ILIKE $${params.length}`);
  }

  if (options.source) {
    params.push(`%${options.source}%`);
    clauses.push(`s.name ILIKE $${params.length}`);
  }

  if (options.narrator) {
    params.push(`%${options.narrator}%`);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_chain hc
         JOIN chain_narrator cn ON cn.chain_id = hc.id
         JOIN narrator n ON n.id = cn.narrator_id
         WHERE hc.hadith_id = h.id AND n.name ILIKE $${params.length}
       )`,
    );
  }

  if (options.tag) {
    params.push(`%${options.tag}%`);
    clauses.push(
      `EXISTS (
         SELECT 1
         FROM hadith_tag ht
         JOIN tag t ON t.id = ht.tag_id
         WHERE ht.hadith_id = h.id AND t.name ILIKE $${params.length}
       )`,
    );
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const client = await getClient();
  try {
    const { rows } = await client.query<{
      id: number;
      number: number;
      display_number: string | null;
      source: string;
      book: string | null;
      chapter: string | null;
      matn: string;
      tags: string[] | null;
    }>(
      `
        SELECT
          h.id,
          h.number,
          h.display_number,
          s.name AS source,
          b.name AS book,
          c.name AS chapter,
          m.text_en AS matn,
          tag_rollup.tags
        FROM hadith h
        JOIN source s ON s.id = h.source_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        JOIN matn m ON m.id = h.matn_id
        LEFT JOIN LATERAL (
          SELECT array_agg(t.name ORDER BY t.name) AS tags
          FROM hadith_tag ht
          JOIN tag t ON t.id = ht.tag_id
          WHERE ht.hadith_id = h.id
        ) AS tag_rollup ON TRUE
        ${where}
        ORDER BY h.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, pageSize, offset],
    );

    const countResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(*) AS count
        FROM hadith h
        JOIN source s ON s.id = h.source_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        JOIN matn m ON m.id = h.matn_id
        ${where}
      `,
      params,
    );

    const items: AdminHadithSummary[] = rows.map((row) => ({
      id: row.id,
      hadithNumber: row.number,
      displayNumber: row.display_number ?? String(row.number),
      source: row.source,
      book: row.book,
      chapter: row.chapter,
      tags: row.tags ?? [],
      matnPreview: row.matn.length > MATN_PREVIEW ? `${row.matn.slice(0, MATN_PREVIEW)}…` : row.matn,
    }));

    return {
      items,
      total: Number(countResult.rows[0]?.count ?? 0),
    };
  } finally {
    client.release();
  }
}

export async function getAdminHadith(id: number): Promise<AdminHadithDetail | null> {
  const client = await getClient();
  try {
    const { rows } = await client.query<{
      id: number;
      number: number;
      display_number: string | null;
      source_id: number;
      source: string;
      book_id: number | null;
      book: string | null;
      book_number: number | null;
      chapter_id: number | null;
      chapter: string | null;
      chapter_number: number | null;
      matn: string;
      sanad: string | null;
      location: string | null;
      narration_level_id: number | null;
      chain_type_id: number | null;
      attribution_type_id: number | null;
      grades: AdminGradeInput[] | null;
      identifiers: AdminIdentifierInput[] | null;
      tags: string[] | null;
      chain_id: number | null;
    }>(
      `
        SELECT
          h.id,
          h.number,
          h.display_number,
          h.source_id,
          s.name AS source,
          h.book_id,
          b.name AS book,
          b.number AS book_number,
          h.chapter_id,
          c.name AS chapter,
          c.number AS chapter_number,
          m.text_en AS matn,
          h.sanad,
          h.location,
          hc.narration_level_id,
          hc.chain_type_id,
          hc.attribution_type_id,
          hc.id AS chain_id,
          grades.rollup AS grades,
          ids.identifiers AS identifiers,
          tag_rollup.tags
        FROM hadith h
        JOIN source s ON s.id = h.source_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        JOIN matn m ON m.id = h.matn_id
        LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id AND hc.is_primary = true
        LEFT JOIN LATERAL (
          SELECT json_agg(
                   json_build_object(
                     'gradeId', g.id,
                     'gradeTitle', g.name,
                     'scholarId', sc.id,
                     'scholarName', sc.name,
                     'scholarLifespan', sc.lifespan_label,
                     'isPrimary', hg.is_primary
                   )
                   ORDER BY hg.is_primary DESC, sc.name
                 ) AS rollup
          FROM hadith_grade hg
          JOIN grade g ON g.id = hg.grade_id
          JOIN scholar sc ON sc.id = hg.scholar_id
          WHERE hg.hadith_id = h.id
        ) AS grades ON TRUE
        LEFT JOIN LATERAL (
          SELECT json_agg(
                   json_build_object(
                     'schemeKey', hi.scheme_key,
                     'identifier', hi.identifier,
                     'notes', hi.notes,
                     'isPrimary', hi.is_primary
                   )
                   ORDER BY hi.scheme_key, hi.identifier
                 ) AS identifiers
          FROM hadith_identifier hi
          WHERE hi.hadith_id = h.id
        ) AS ids ON TRUE
        LEFT JOIN LATERAL (
          SELECT array_agg(t.name ORDER BY t.name) AS tags
          FROM hadith_tag ht
          JOIN tag t ON t.id = ht.tag_id
          WHERE ht.hadith_id = h.id
        ) AS tag_rollup ON TRUE
        WHERE h.id = $1 AND h.deleted_at IS NULL
      `,
      [id],
    );

    if (!rows.length) return null;
    const row = rows[0];
    const narrators = row.chain_id ? await fetchNarrators(client, row.chain_id) : [];

    return {
      id: row.id,
      hadithNumber: row.number,
      displayNumber: row.display_number ?? String(row.number),
      sourceId: row.source_id,
      source: row.source,
      bookId: row.book_id,
      book: row.book,
      bookNumber: row.book_number,
      chapterId: row.chapter_id,
      chapter: row.chapter,
      chapterNumber: row.chapter_number,
      matn: row.matn,
      sanad: row.sanad,
      location: row.location,
      narrationLevelId: row.narration_level_id,
      chainTypeId: row.chain_type_id,
      attributionTypeId: row.attribution_type_id,
      narrators,
      tags: row.tags ?? [],
      identifiers: row.identifiers ?? [],
      grades: row.grades ?? [],
    };
  } finally {
    client.release();
  }
}

async function fetchNarrators(client: PoolClient, chainId: number): Promise<AdminNarratorInput[]> {
  const { rows } = await client.query<{
    name: string;
    descriptor: string | null;
    role: string | null;
    classification_id: number | null;
    reliability_id: number | null;
    transmission_method_id: number | null;
  }>(
    `
      SELECT
        n.name,
        n.descriptor,
        cn.role,
        cn.classification_id,
        cn.reliability_id,
        cn.transmission_method_id
      FROM chain_narrator cn
      JOIN narrator n ON n.id = cn.narrator_id
      WHERE cn.chain_id = $1
      ORDER BY cn.position
    `,
    [chainId],
  );

  return rows.map((row) => ({
    name: row.name,
    descriptor: row.descriptor,
    role: row.role === "prophet" ? "prophet" : "narrator",
    classificationId: row.classification_id,
    reliabilityId: row.reliability_id,
    transmissionMethodId: row.transmission_method_id,
  }));
}

export async function createAdminHadith(payload: AdminHadithPayload): Promise<AdminHadithDetail> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const { sourceId, bookId, chapterId, matnId } = await resolvePrimaryEntities(client, payload);
    const displayNumber = payload.displayNumber ?? String(payload.hadithNumber);
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO hadith (number, display_number, source_id, book_id, chapter_id, matn_id, location, sanad)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `,
      [
        payload.hadithNumber,
        displayNumber,
        sourceId,
        bookId,
        chapterId,
        matnId,
        payload.location ?? null,
        payload.sanad ?? null,
      ],
    );
    const hadithId = result.rows[0].id;
    await replaceTags(client, hadithId, payload.tags ?? []);
    await replaceIdentifiers(client, hadithId, payload.identifiers ?? []);
    await upsertChainAndNarrators(client, hadithId, payload);
    await replaceGrades(client, hadithId, payload);
    await client.query("COMMIT");
    const detail = await getAdminHadith(hadithId);
    if (!detail) {
      throw new Error("Failed to reload created hadith");
    }
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAdminHadith(id: number, payload: AdminHadithPayload): Promise<AdminHadithDetail> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const { sourceId, bookId, chapterId, matnId } = await resolvePrimaryEntities(client, payload);
    const displayNumber = payload.displayNumber ?? String(payload.hadithNumber);
    await client.query(
      `
        UPDATE hadith
        SET
          number = $1,
          display_number = $2,
          source_id = $3,
          book_id = $4,
          chapter_id = $5,
          matn_id = $6,
          location = $7,
          sanad = $8,
          deleted_at = NULL
        WHERE id = $9
      `,
      [
        payload.hadithNumber,
        displayNumber,
        sourceId,
        bookId,
        chapterId,
        matnId,
        payload.location ?? null,
        payload.sanad ?? null,
        id,
      ],
    );

    await replaceTags(client, id, payload.tags ?? []);
    await replaceIdentifiers(client, id, payload.identifiers ?? []);
    await upsertChainAndNarrators(client, id, payload);
    await replaceGrades(client, id, payload);
    await client.query("COMMIT");
    const detail = await getAdminHadith(id);
    if (!detail) throw new Error("Failed to reload updated hadith");
    return detail;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteHadith(id: number): Promise<boolean> {
  const client = await getClient();
  try {
    const result = await client.query("UPDATE hadith SET deleted_at = NOW() WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

async function resolvePrimaryEntities(
  client: PoolClient,
  payload: AdminHadithPayload,
): Promise<{ sourceId: number; bookId: number | null; chapterId: number | null; matnId: number }> {
  const sourceId = await assertLookupExists(client, "source", payload.sourceId, "source");
  const bookId = normalizeId(payload.bookId)
    ? await assertLookupExists(client, "book", payload.bookId as number, "book")
    : null;
  const chapterId = normalizeId(payload.chapterId)
    ? await assertLookupExists(client, "chapter", payload.chapterId as number, "chapter")
    : null;
  const matnId = await ensureMatn(client, payload.matn);
  return { sourceId, bookId, chapterId, matnId };
}

async function assertLookupExists(client: PoolClient, table: string, id: number, label: string) {
  const normalized = normalizeId(id);
  if (!normalized) {
    throw new AdminInputError(`Select a valid ${label} from the list.`);
  }
  const exists = await client.query<{ exists: boolean }>(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE id = $1) AS exists`, [
    normalized,
  ]);
  if (!exists.rows[0]?.exists) {
    throw new AdminInputError(`Selected ${label} does not exist.`);
  }
  return normalized;
}

async function assertOptionalLookup(
  client: PoolClient,
  table: string,
  id: number | null | undefined,
  label: string,
): Promise<number | null> {
  const normalized = normalizeId(id);
  if (!normalized) return null;
  return assertLookupExists(client, table, normalized, label);
}

async function ensureMatn(client: PoolClient, text: string): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM matn WHERE text_en = $1 LIMIT 1", [text]);
  if (existing.rowCount) return existing.rows[0].id;
  const inserted = await client.query<{ id: number }>("INSERT INTO matn (text_en) VALUES ($1) RETURNING id", [text]);
  return inserted.rows[0].id;
}

async function upsertChainAndNarrators(client: PoolClient, hadithId: number, payload: AdminHadithPayload) {
  const narrationLevelId = await assertOptionalLookup(
    client,
    "narration_level",
    payload.narrationLevelId,
    "narration level",
  );
  const chainTypeId = await assertOptionalLookup(client, "chain_type", payload.chainTypeId, "chain type");
  const attributionTypeId = await assertOptionalLookup(client, "attribution_type", payload.attributionTypeId, "attribution");

  const existing = await client.query<{ id: number }>(
    "SELECT id FROM hadith_chain WHERE hadith_id = $1 AND is_primary = true",
    [hadithId],
  );
  let chainId: number;
  if (existing.rowCount) {
    chainId = existing.rows[0].id;
    await client.query(
      `
        UPDATE hadith_chain
        SET narration_level_id = $1, chain_type_id = $2, attribution_type_id = $3
        WHERE id = $4
      `,
      [narrationLevelId, chainTypeId, attributionTypeId, chainId],
    );
    await client.query("DELETE FROM chain_narrator WHERE chain_id = $1", [chainId]);
  } else {
    const inserted = await client.query<{ id: number }>(
      `
        INSERT INTO hadith_chain (hadith_id, narration_level_id, chain_type_id, attribution_type_id, is_primary, label)
        VALUES ($1, $2, $3, $4, true, $5)
        RETURNING id
      `,
      [hadithId, narrationLevelId, chainTypeId, attributionTypeId, "Primary"],
    );
    chainId = inserted.rows[0].id;
  }

  const narrators = payload.narrators ?? [];
  for (let index = 0; index < narrators.length; index += 1) {
    const narrator = narrators[index];
    const narratorId = await ensureNarrator(client, narrator.name, narrator.descriptor ?? undefined);
    const classificationId = await assertOptionalLookup(
      client,
      "narrator_tier",
      narrator.classificationId,
      "narrator tier",
    );
    const reliabilityId = await assertOptionalLookup(
      client,
      "reliability_tier",
      narrator.reliabilityId,
      "reliability tier",
    );
    const transmissionMethodId = await assertOptionalLookup(
      client,
      "transmission_method",
      narrator.transmissionMethodId,
      "transmission method",
    );
    await client.query(
      `
        INSERT INTO chain_narrator (
          chain_id,
          narrator_id,
          position,
          role,
          classification_id,
          reliability_id,
          transmission_method_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        chainId,
        narratorId,
        index + 1,
        narrator.role === "prophet" ? "prophet" : "narrator",
        classificationId,
        reliabilityId,
        transmissionMethodId,
      ],
    );
  }
}

async function ensureNarrator(client: PoolClient, name: string, descriptor?: string): Promise<number> {
  const trimmed = name.trim();
  const existing = await client.query<{ id: number }>("SELECT id FROM narrator WHERE name = $1", [trimmed]);
  if (existing.rowCount) return existing.rows[0].id;
  const inserted = await client.query<{ id: number }>(
    "INSERT INTO narrator (name, descriptor) VALUES ($1, $2) RETURNING id",
    [trimmed, descriptor ?? null],
  );
  return inserted.rows[0].id;
}

async function replaceTags(client: PoolClient, hadithId: number, tags: string[]) {
  await client.query("DELETE FROM hadith_tag WHERE hadith_id = $1", [hadithId]);
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const id = await ensureTag(client, trimmed);
    await client.query(
      `INSERT INTO hadith_tag (hadith_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (hadith_id, tag_id) DO NOTHING`,
      [hadithId, id],
    );
  }
}

async function ensureTag(client: PoolClient, name: string): Promise<number> {
  const existing = await client.query<{ id: number }>("SELECT id FROM tag WHERE name = $1", [name]);
  if (existing.rowCount) return existing.rows[0].id;
  const inserted = await client.query<{ id: number }>("INSERT INTO tag (name) VALUES ($1) RETURNING id", [name]);
  return inserted.rows[0].id;
}

async function replaceIdentifiers(client: PoolClient, hadithId: number, identifiers: AdminIdentifierInput[]) {
  await client.query("DELETE FROM hadith_identifier WHERE hadith_id = $1", [hadithId]);
  for (const item of identifiers) {
    if (!item.schemeKey || !item.identifier) continue;
    await client.query(
      `
        INSERT INTO hadith_identifier (hadith_id, scheme_key, identifier, notes, is_primary)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (hadith_id, scheme_key, identifier)
        DO UPDATE SET notes = EXCLUDED.notes, is_primary = EXCLUDED.is_primary
      `,
      [hadithId, item.schemeKey, item.identifier, item.notes ?? null, item.isPrimary ?? false],
    );
  }
}

async function replaceGrades(client: PoolClient, hadithId: number, payload: AdminHadithPayload) {
  await client.query("DELETE FROM hadith_grade WHERE hadith_id = $1", [hadithId]);
  const primaryGrade = normalizeId(payload.gradeId);
  const gradeEntries =
    payload.grades && payload.grades.length > 0
      ? payload.grades
      : primaryGrade
        ? [{ gradeId: primaryGrade, scholarId: null, isPrimary: true }]
        : [];

  for (let index = 0; index < gradeEntries.length; index += 1) {
    const entry = gradeEntries[index];
    const gradeId = normalizeId(entry.gradeId) ?? primaryGrade;
    if (!gradeId) continue;
    await assertLookupExists(client, "grade", gradeId, "grade");

    const scholarId = normalizeId(entry.scholarId);
    if (!scholarId) {
      throw new AdminInputError("Select a scholar when assigning a grade.");
    }
    await assertLookupExists(client, "scholar", scholarId, "scholar");
    const isPrimary = entry.isPrimary ?? index === 0;
    await client.query(
      `
        INSERT INTO hadith_grade (hadith_id, grade_id, scholar_id, is_primary)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (hadith_id, scholar_id)
        DO UPDATE SET grade_id = EXCLUDED.grade_id, is_primary = EXCLUDED.is_primary
      `,
      [hadithId, gradeId, scholarId, isPrimary],
    );
  }
}

export async function fetchAdminLookups(): Promise<AdminLookups> {
  const client = await getClient();
  try {
    const [
      sources,
      books,
      chapters,
      narrationLevels,
      chainTypes,
      attributionTypes,
      grades,
      scholars,
      tags,
      authors,
      narratorTiers,
      reliabilityTiers,
      transmissionMethods,
    ] =
      await Promise.all([
        client.query<LookupOption>("SELECT id, name AS label FROM source ORDER BY name"),
        client.query<BookLookup>(
          "SELECT id, name AS label, number, source_id AS \"sourceId\" FROM book ORDER BY source_id, number NULLS LAST",
        ),
        client.query<ChapterLookup>(
          "SELECT id, name AS label, number, book_id AS \"bookId\" FROM chapter ORDER BY book_id, number NULLS LAST",
        ),
        client.query<LookupOption>(
          "SELECT id, name_en AS label, name_ar AS secondary FROM narration_level ORDER BY id",
        ),
        client.query<LookupOption>("SELECT id, name_en AS label, name_ar AS secondary FROM chain_type ORDER BY id"),
        client.query<LookupOption>(
          "SELECT id, name_en AS label, name_ar AS secondary FROM attribution_type ORDER BY id",
        ),
        client.query<LookupOption>("SELECT id, name AS label, description AS secondary FROM grade ORDER BY name"),
        client.query<LookupOption>("SELECT id, name AS label, lifespan_label AS secondary FROM scholar ORDER BY name"),
        client.query<LookupOption>("SELECT id, name AS label FROM tag ORDER BY name"),
        client.query<LookupOption>("SELECT id, name AS label, lifespan_label AS secondary FROM author ORDER BY name"),
        client.query<LookupOption>(
          "SELECT id, name AS label, secondary_label AS secondary FROM narrator_tier ORDER BY id",
        ),
        client.query<LookupOption>(
          "SELECT id, name AS label, secondary_label AS secondary FROM reliability_tier ORDER BY id",
        ),
        client.query<LookupOption>(
          "SELECT id, name AS label, description AS secondary FROM transmission_method ORDER BY id",
        ),
      ]);

    return {
      sources: sources.rows,
      books: books.rows,
      chapters: chapters.rows,
      narrationLevels: narrationLevels.rows,
      chainTypes: chainTypes.rows,
      attributionTypes: attributionTypes.rows,
      grades: grades.rows,
      scholars: scholars.rows,
      tags: tags.rows,
      authors: authors.rows,
      narratorTiers: narratorTiers.rows,
      reliabilityTiers: reliabilityTiers.rows,
      transmissionMethods: transmissionMethods.rows,
    };
  } finally {
    client.release();
  }
}
