import fs from "fs";
import path from "path";

import { Pool, PoolClient } from "pg";

import { dbConfig } from "@/server/db/config";

type HadithRow = {
  id: number;
  collection: string;
  in_book_reference: string;
  bukhari_book: number;
  bukhari_hadith: number;
  book_name_en: string;
  book_name_ar: string;
  chapter_no: number;
  chapter_name_en: string;
  chapter_name_ar: string;
  english_translation_ref: string;
  reference: string;
  arabic_tashkeel: string;
  arabic_no_tashkeel: string;
  translation_en: string;
  chain_scholar_ids: number[];
  narrator_chain_names: string;
  narrator_chain_names_ar: string;
  narrator_generation_numbers: number[];
  narrator_reliability_tiers: string[];
  narrator_place_of_stay: string[];
  narrator_birth_dates: string[];
  narrator_death_dates: string[];
  generational_rank: string;
  source_url: string;
  site_id: number;
  global_id: number;
  bukhari_hadith_header: number;
  reference_num: number;
  bukhari_key: string;
  translation_is_reference: boolean;
  translation_ref_target: number | null;
  chain_debug_excerpt: string;
  debug_notes: string;
};

const DATA_PATH = path.join(process.cwd(), "scrapped-data", "bukhari_hadiths_20260107_013449.jsonl");
const TARGET_IDS: number[] = [];
const IMPORT_IDS = process.env.IMPORT_IDS
  ? process.env.IMPORT_IDS.split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value))
  : TARGET_IDS;

const caches = {
  authorByName: new Map<string, number>(),
  sourceByName: new Map<string, number>(),
  bookByKey: new Map<string, number>(),
  chapterByKey: new Map<string, number>(),
  narratorByName: new Map<string, number>(),
  narratorTierByName: new Map<string, number>(),
  reliabilityTierByName: new Map<string, number>(),
  matnByKey: new Map<string, number>(),
  gradeByName: new Map<string, number>(),
  scholarByName: new Map<string, number>(),
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function coerceParts(parts: string[], expected: number): string[] {
  if (expected <= 0) return [];
  const next = [...parts];
  while (next.length > expected) {
    const tail = next.pop();
    const head = next.pop();
    if (head === undefined) {
      if (tail !== undefined) next.push(tail);
      break;
    }
    next.push(`${head}, ${tail ?? ""}`.trim());
  }
  while (next.length < expected) {
    next.push("");
  }
  return next;
}

function coerceArray<T>(items: T[], expected: number, filler: T): T[] {
  if (expected <= 0) return [];
  const next = [...items];
  if (next.length > expected) return next.slice(0, expected);
  while (next.length < expected) next.push(filler);
  return next;
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function normalizeCollectionName(value: string): string {
  if (value.trim() === "Sahih Bukhari") return "Sahih al-Bukhari";
  return value.trim();
}

function buildLifespan(birth?: string, death?: string): string | null {
  const parts: string[] = [];
  if (!isBlank(birth)) parts.push(`b. ${birth}`);
  if (!isBlank(death)) parts.push(`d. ${death}`);
  return parts.length ? parts.join("; ") : null;
}

function buildDescriptor({
  nameAr,
  scholarId,
  generationNumber,
  generationRank,
  reliability,
  place,
  birth,
  death,
}: {
  nameAr?: string;
  scholarId?: number;
  generationNumber?: number;
  generationRank?: string;
  reliability?: string;
  place?: string;
  birth?: string;
  death?: string;
}): string | null {
  const parts: string[] = [];
  if (!isBlank(nameAr)) parts.push(`ar:${nameAr}`);
  if (typeof scholarId === "number") parts.push(`ext_id:${scholarId}`);
  if (typeof generationNumber === "number") parts.push(`gen_no:${generationNumber}`);
  if (!isBlank(generationRank)) parts.push(`rank:${generationRank}`);
  if (!isBlank(reliability)) parts.push(`reliability:${reliability}`);
  if (!isBlank(place)) parts.push(`place:${place}`);
  if (!isBlank(birth)) parts.push(`born:${birth}`);
  if (!isBlank(death)) parts.push(`died:${death}`);
  return parts.length ? parts.join(" | ") : null;
}

function readRows(filePath: string): HadithRow[] {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HadithRow);
}

async function getOrCreateAuthor(client: PoolClient, name: string, lifespan: string | null) {
  if (caches.authorByName.has(name)) return caches.authorByName.get(name)!;
  const existing = await client.query<{ id: number }>("SELECT id FROM author WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO author (name, lifespan_label) VALUES ($1, $2) RETURNING id",
      [name, lifespan],
    );
    id = result.rows[0].id;
  }
  caches.authorByName.set(name, id);
  return id;
}

async function getOrCreateSource(client: PoolClient, name: string) {
  if (caches.sourceByName.has(name)) return caches.sourceByName.get(name)!;
  const existing = await client.query<{ id: number }>("SELECT id FROM source WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const authorName = name === "Sahih al-Bukhari" ? "Imam al-Bukhari" : "Unknown Author";
    const authorLifespan = name === "Sahih al-Bukhari" ? "194-256 AH" : null;
    const authorId = await getOrCreateAuthor(client, authorName, authorLifespan);
    const result = await client.query<{ id: number }>(
      "INSERT INTO source (name, author_id) VALUES ($1, $2) RETURNING id",
      [name, authorId],
    );
    id = result.rows[0].id;
  }
  caches.sourceByName.set(name, id);
  return id;
}

async function getOrCreateBook(
  client: PoolClient,
  sourceId: number,
  bookNumber: number,
  bookName: string,
) {
  const cacheKey = `${sourceId}:${bookNumber}:${bookName}`;
  if (caches.bookByKey.has(cacheKey)) return caches.bookByKey.get(cacheKey)!;
  const existingByNumber = await client.query<{ id: number }>(
    "SELECT id FROM book WHERE source_id = $1 AND number = $2 LIMIT 1",
    [sourceId, bookNumber],
  );
  let id: number;
  if (existingByNumber.rowCount) {
    id = existingByNumber.rows[0].id;
    await client.query("UPDATE book SET name = $1 WHERE id = $2 AND (name IS DISTINCT FROM $1)", [bookName, id]);
  } else {
    const existingByName = await client.query<{ id: number }>(
      "SELECT id FROM book WHERE source_id = $1 AND name = $2 LIMIT 1",
      [sourceId, bookName],
    );
    if (existingByName.rowCount) {
      id = existingByName.rows[0].id;
      await client.query("UPDATE book SET number = $1 WHERE id = $2 AND (number IS DISTINCT FROM $1)", [bookNumber, id]);
    } else {
      const result = await client.query<{ id: number }>(
        "INSERT INTO book (source_id, name, number) VALUES ($1, $2, $3) RETURNING id",
        [sourceId, bookName, bookNumber],
      );
      id = result.rows[0].id;
    }
  }
  caches.bookByKey.set(cacheKey, id);
  return id;
}

async function getOrCreateChapter(
  client: PoolClient,
  bookId: number,
  chapterNumber: number,
  chapterName: string,
) {
  const cacheKey = `${bookId}:${chapterNumber}:${chapterName}`;
  if (caches.chapterByKey.has(cacheKey)) return caches.chapterByKey.get(cacheKey)!;
  const existingByNumber = await client.query<{ id: number }>(
    "SELECT id FROM chapter WHERE book_id = $1 AND number = $2 LIMIT 1",
    [bookId, chapterNumber],
  );
  let id: number;
  if (existingByNumber.rowCount) {
    id = existingByNumber.rows[0].id;
    await client.query("UPDATE chapter SET name = $1 WHERE id = $2 AND (name IS DISTINCT FROM $1)", [chapterName, id]);
  } else {
    const existingByName = await client.query<{ id: number }>(
      "SELECT id FROM chapter WHERE book_id = $1 AND name = $2 LIMIT 1",
      [bookId, chapterName],
    );
    if (existingByName.rowCount) {
      id = existingByName.rows[0].id;
      await client.query(
        "UPDATE chapter SET number = $1 WHERE id = $2 AND (number IS DISTINCT FROM $1)",
        [chapterNumber, id],
      );
    } else {
      const result = await client.query<{ id: number }>(
        "INSERT INTO chapter (book_id, name, number) VALUES ($1, $2, $3) RETURNING id",
        [bookId, chapterName, chapterNumber],
      );
      id = result.rows[0].id;
    }
  }
  caches.chapterByKey.set(cacheKey, id);
  return id;
}

async function getOrCreateNarratorTier(client: PoolClient, name: string) {
  if (caches.narratorTierByName.has(name)) return caches.narratorTierByName.get(name)!;
  const existing = await client.query<{ id: number }>("SELECT id FROM narrator_tier WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO narrator_tier (name) VALUES ($1) RETURNING id",
      [name],
    );
    id = result.rows[0].id;
  }
  caches.narratorTierByName.set(name, id);
  return id;
}

async function getOrCreateReliabilityTier(client: PoolClient, name: string) {
  if (caches.reliabilityTierByName.has(name)) return caches.reliabilityTierByName.get(name)!;
  const existing = await client.query<{ id: number }>("SELECT id FROM reliability_tier WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO reliability_tier (name) VALUES ($1) RETURNING id",
      [name],
    );
    id = result.rows[0].id;
  }
  caches.reliabilityTierByName.set(name, id);
  return id;
}

async function getOrCreateNarrator(
  client: PoolClient,
  name: string,
  descriptor: string | null,
  lifespan: string | null,
) {
  if (caches.narratorByName.has(name)) return caches.narratorByName.get(name)!;
  const existing = await client.query<{ id: number; descriptor: string | null; lifespan: string | null }>(
    "SELECT id, descriptor, lifespan FROM narrator WHERE name = $1",
    [name],
  );
  let id: number;
  if (existing.rowCount) {
    const row = existing.rows[0];
    id = row.id;
    const updates: string[] = [];
    const params: unknown[] = [];
    let index = 1;
    let mergedDescriptor = row.descriptor;
    if (!isBlank(descriptor)) {
      if (isBlank(row.descriptor)) {
        mergedDescriptor = descriptor;
      } else if (descriptor && !row.descriptor?.includes(descriptor)) {
        mergedDescriptor = `${row.descriptor} | ${descriptor}`;
      }
    }
    if (mergedDescriptor !== row.descriptor) {
      updates.push(`descriptor = $${index++}`);
      params.push(mergedDescriptor);
    }
    let mergedLifespan = row.lifespan;
    if (isBlank(row.lifespan) && !isBlank(lifespan)) {
      mergedLifespan = lifespan;
      updates.push(`lifespan = $${index++}`);
      params.push(mergedLifespan);
    }
    if (updates.length) {
      params.push(id);
      await client.query(`UPDATE narrator SET ${updates.join(", ")} WHERE id = $${index}`, params);
    }
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO narrator (name, descriptor, lifespan) VALUES ($1, $2, $3) RETURNING id",
      [name, descriptor, lifespan],
    );
    id = result.rows[0].id;
  }
  caches.narratorByName.set(name, id);
  return id;
}

async function getOrCreateGrade(client: PoolClient, name: string) {
  if (caches.gradeByName.has(name)) return caches.gradeByName.get(name)!;
  const existing = await client.query<{ id: number }>("SELECT id FROM grade WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO grade (name, description) VALUES ($1, $2) RETURNING id",
      [name, name],
    );
    id = result.rows[0].id;
  }
  caches.gradeByName.set(name, id);
  return id;
}

async function getOrCreateScholar(client: PoolClient, name: string, lifespan: string | null) {
  if (caches.scholarByName.has(name)) return caches.scholarByName.get(name)!;
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM scholar WHERE name = $1 AND lifespan_label IS NOT DISTINCT FROM $2",
    [name, lifespan],
  );
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO scholar (name, lifespan_label) VALUES ($1, $2) RETURNING id",
      [name, lifespan],
    );
    id = result.rows[0].id;
  }
  caches.scholarByName.set(name, id);
  return id;
}

async function getOrCreateMatn(
  client: PoolClient,
  textEn: string,
  textAr: string | null,
) {
  const cacheKey = `${textEn}:${textAr ?? ""}`;
  if (caches.matnByKey.has(cacheKey)) return caches.matnByKey.get(cacheKey)!;
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM matn WHERE text_en = $1 AND text_ar IS NOT DISTINCT FROM $2 LIMIT 1",
    [textEn, textAr],
  );
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO matn (text_en, text_ar) VALUES ($1, $2) RETURNING id",
      [textEn, textAr],
    );
    id = result.rows[0].id;
  }
  caches.matnByKey.set(cacheKey, id);
  return id;
}

async function upsertHadith(
  client: PoolClient,
  {
    number,
    sourceId,
    bookId,
    chapterId,
    matnId,
    location,
    sanad,
    displayNumber,
  }: {
    number: number;
    sourceId: number;
    bookId: number;
    chapterId: number;
    matnId: number;
    location: string | null;
    sanad: string | null;
    displayNumber: string | null;
  },
) {
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM hadith WHERE number = $1 AND source_id = $2 LIMIT 1",
    [number, sourceId],
  );
  if (existing.rowCount) {
    const id = existing.rows[0].id;
    await client.query(
      `UPDATE hadith
       SET book_id = $1,
           chapter_id = $2,
           matn_id = $3,
           location = $4,
           sanad = $5,
           display_number = COALESCE(display_number, $6),
           deleted_at = NULL
       WHERE id = $7`,
      [bookId, chapterId, matnId, location, sanad, displayNumber, id],
    );
    return id;
  }
  const result = await client.query<{ id: number }>(
    `INSERT INTO hadith (number, book_id, chapter_id, source_id, matn_id, location, sanad, display_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [number, bookId, chapterId, sourceId, matnId, location, sanad, displayNumber],
  );
  return result.rows[0].id;
}

async function upsertHadithGrade(
  client: PoolClient,
  hadithId: number,
  gradeName: string,
  scholarName: string,
  scholarLifespan: string | null,
) {
  const gradeId = await getOrCreateGrade(client, gradeName);
  const scholarId = await getOrCreateScholar(client, scholarName, scholarLifespan);
  await client.query(
    `INSERT INTO hadith_grade (hadith_id, grade_id, scholar_id, is_primary)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (hadith_id, scholar_id)
     DO UPDATE SET grade_id = EXCLUDED.grade_id, is_primary = true`,
    [hadithId, gradeId, scholarId],
  );
}

async function ensureHadithIdentifier(
  client: PoolClient,
  hadithId: number,
  schemeKey: string,
  identifier: string | number | null,
  isPrimary = false,
) {
  if (identifier === null || identifier === undefined) return;
  const value = String(identifier);
  if (!value.trim()) return;
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM hadith_identifier WHERE hadith_id = $1 AND scheme_key = $2 AND identifier = $3",
    [hadithId, schemeKey, value],
  );
  if (existing.rowCount) return;
  await client.query(
    "INSERT INTO hadith_identifier (hadith_id, scheme_key, identifier, is_primary) VALUES ($1, $2, $3, $4)",
    [hadithId, schemeKey, value, isPrimary],
  );
}

async function upsertHadithChain(client: PoolClient, hadithId: number) {
  const existing = await client.query<{ id: number }>("SELECT id FROM hadith_chain WHERE hadith_id = $1", [hadithId]);
  if (existing.rowCount) {
    const chainId = existing.rows[0].id;
    await client.query("UPDATE hadith_chain SET is_primary = true WHERE id = $1", [chainId]);
    await client.query("DELETE FROM chain_narrator WHERE chain_id = $1", [chainId]);
    return chainId;
  }
  const result = await client.query<{ id: number }>(
    "INSERT INTO hadith_chain (hadith_id, is_primary, label) VALUES ($1, true, $2) RETURNING id",
    [hadithId, "Primary"],
  );
  return result.rows[0].id;
}

async function insertChainNarrators(
  client: PoolClient,
  chainId: number,
  row: HadithRow,
) {
  const namesEnRaw = splitList(row.narrator_chain_names ?? "");
  const namesArRaw = splitList(row.narrator_chain_names_ar ?? "");
  const ranksRaw = splitList(row.generational_rank ?? "");
  const chainIdCount = row.chain_scholar_ids.length;
  const expected =
    chainIdCount > 0
      ? chainIdCount
      : Math.max(
          namesEnRaw.length,
          namesArRaw.length,
          ranksRaw.length,
          row.narrator_generation_numbers.length,
          row.narrator_reliability_tiers.length,
          row.narrator_place_of_stay.length,
          row.narrator_birth_dates.length,
          row.narrator_death_dates.length,
        );

  const namesEn = coerceParts(namesEnRaw, expected);
  const namesAr = coerceParts(namesArRaw, expected);
  const ranks = coerceParts(ranksRaw, expected);
  const scholarIds = coerceArray<number | null>(row.chain_scholar_ids, expected, null);
  const generationNumbers = coerceArray<number | null>(row.narrator_generation_numbers, expected, null);
  const reliabilityTiers = coerceArray<string | null>(row.narrator_reliability_tiers, expected, null);
  const places = coerceArray<string | null>(row.narrator_place_of_stay, expected, null);
  const birthDates = coerceArray<string | null>(row.narrator_birth_dates, expected, null);
  const deathDates = coerceArray<string | null>(row.narrator_death_dates, expected, null);

  for (let index = 0; index < expected; index += 1) {
    const name = namesEn[index] || `Narrator ${index + 1}`;
    const descriptor = buildDescriptor({
      nameAr: namesAr[index] || undefined,
      scholarId: scholarIds[index] ?? undefined,
      generationNumber: generationNumbers[index] ?? undefined,
      generationRank: ranks[index] || undefined,
      reliability: reliabilityTiers[index] || undefined,
      place: places[index] || undefined,
      birth: birthDates[index] || undefined,
      death: deathDates[index] || undefined,
    });
    const lifespan = buildLifespan(birthDates[index] ?? undefined, deathDates[index] ?? undefined);
    const narratorId = await getOrCreateNarrator(client, name, descriptor, lifespan);

    const classificationName = ranks[index];
    const classificationId =
      classificationName && !isBlank(classificationName)
        ? await getOrCreateNarratorTier(client, classificationName)
        : null;

    const reliabilityName = reliabilityTiers[index];
    const reliabilityId =
      reliabilityName && !isBlank(reliabilityName)
        ? await getOrCreateReliabilityTier(client, reliabilityName)
        : null;

    await client.query(
      `INSERT INTO chain_narrator (
        chain_id,
        narrator_id,
        position,
        role,
        classification_id,
        reliability_id,
        transmission_method_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [chainId, narratorId, index + 1, "narrator", classificationId, reliabilityId, null],
    );
  }

  const prophetName = "Prophet Muhammad";
  const prophetDescriptor = "Messenger of Allah";
  const prophetId = await getOrCreateNarrator(client, prophetName, prophetDescriptor, null);
  await client.query(
    `INSERT INTO chain_narrator (
      chain_id,
      narrator_id,
      position,
      role,
      classification_id,
      reliability_id,
      transmission_method_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [chainId, prophetId, expected + 1, "prophet", null, null, null],
  );
}

async function enqueueHadithSync(client: PoolClient, hadithId: number) {
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM hadith_sync_queue WHERE hadith_id = $1 AND processed_at IS NULL",
    [hadithId],
  );
  if (existing.rowCount) return;
  await client.query(
    "INSERT INTO hadith_sync_queue (hadith_id, needs_graph, needs_embedding) VALUES ($1, true, true)",
    [hadithId],
  );
}

async function main() {
  const rows = readRows(DATA_PATH);
  const selected =
    IMPORT_IDS.length > 0 ? rows.filter((row) => IMPORT_IDS.includes(row.id)) : rows;
  if (IMPORT_IDS.length > 0 && selected.length !== IMPORT_IDS.length) {
    const found = new Set(selected.map((row) => row.id));
    const missing = IMPORT_IDS.filter((id) => !found.has(id));
    throw new Error(`Missing expected ids: ${missing.join(", ")}`);
  }
  if (selected.length === 0) {
    throw new Error("No hadith rows selected for import.");
  }

  const pool = new Pool(dbConfig);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let successCount = 0;
    const failedIds: number[] = [];
    for (const row of selected) {
      const savepoint = `sp_${row.id}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
        const sourceName = normalizeCollectionName(row.collection);
        const sourceId = await getOrCreateSource(client, sourceName);
        const bookId = await getOrCreateBook(client, sourceId, row.bukhari_book, row.book_name_en);
        const chapterId = await getOrCreateChapter(client, bookId, row.chapter_no, row.chapter_name_en);
        const matnId = await getOrCreateMatn(client, row.translation_en, row.arabic_tashkeel);

        const hadithId = await upsertHadith(client, {
          number: row.bukhari_hadith,
          sourceId,
          bookId,
          chapterId,
          matnId,
          location: row.in_book_reference ?? null,
          sanad: row.narrator_chain_names ?? null,
          displayNumber: row.reference_num ? String(row.reference_num) : null,
        });

        await upsertHadithGrade(client, hadithId, "Ṣaḥīḥ li-dhātih", "Imam al-Bukhari", "194-256 AH");

        await ensureHadithIdentifier(client, hadithId, "collection", row.collection);
        await ensureHadithIdentifier(client, hadithId, "in_book_reference", row.in_book_reference);
        await ensureHadithIdentifier(client, hadithId, "english_translation_ref", row.english_translation_ref);
        await ensureHadithIdentifier(client, hadithId, "reference", row.reference, true);
        await ensureHadithIdentifier(client, hadithId, "bukhari_key", row.bukhari_key);
        await ensureHadithIdentifier(client, hadithId, "source_url", row.source_url);
        await ensureHadithIdentifier(client, hadithId, "site_id", row.site_id);
        await ensureHadithIdentifier(client, hadithId, "global_id", row.global_id);
        await ensureHadithIdentifier(client, hadithId, "bukhari_hadith_header", row.bukhari_hadith_header);
        await ensureHadithIdentifier(client, hadithId, "reference_num", row.reference_num);
        await ensureHadithIdentifier(client, hadithId, "bukhari_book", row.bukhari_book);
        await ensureHadithIdentifier(client, hadithId, "bukhari_hadith", row.bukhari_hadith);
        await ensureHadithIdentifier(client, hadithId, "book_name_ar", row.book_name_ar);
        await ensureHadithIdentifier(client, hadithId, "chapter_name_ar", row.chapter_name_ar);
        await ensureHadithIdentifier(client, hadithId, "arabic_no_tashkeel", row.arabic_no_tashkeel);
        await ensureHadithIdentifier(
          client,
          hadithId,
          "translation_is_reference",
          row.translation_is_reference ? "true" : "false",
        );
        await ensureHadithIdentifier(client, hadithId, "translation_ref_target", row.translation_ref_target);
        await ensureHadithIdentifier(client, hadithId, "chain_debug_excerpt", row.chain_debug_excerpt);
        await ensureHadithIdentifier(client, hadithId, "debug_notes", row.debug_notes);

        const chainId = await upsertHadithChain(client, hadithId);
        await insertChainNarrators(client, chainId, row);
        await enqueueHadithSync(client, hadithId);

        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        successCount += 1;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        failedIds.push(row.id);
        console.warn("[import] skipped row", { id: row.id, error });
      }
    }
    await client.query("COMMIT");
    const failureNote = failedIds.length ? `; failed ids: ${failedIds.join(", ")}` : "";
    console.log(`[import] imported ${successCount}/${selected.length} hadith rows${failureNote}`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[import] failed", error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
