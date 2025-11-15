import { hadithInsights } from "@/lib/hadith/data";
import {
  chainTypeInfo,
  sourceTypeInfo,
  narrationLevelInfo,
  narratorTierInfo,
  reliabilityTierInfo,
  transmissionMethods,
  sourceAuthorMap,
  narratorLifespans,
  getGradingStyle,
} from "@/lib/hadith/taxonomy";
import { getClient } from "@/server/db/client";

import type { HadithInsight } from "@/lib/hadith/types";
import type { PoolClient } from "pg";

type IdCache = Map<string, number>;

type LookupCaches = {
  authors: IdCache;
  sources: IdCache;
  books: IdCache;
  chapters: IdCache;
  grades: IdCache;
  narrationLevels: IdCache;
  attributionTypes: IdCache;
  chainTypes: IdCache;
  narratorTiers: IdCache;
  reliabilityTiers: IdCache;
  transmissionMethods: IdCache;
  narrators: IdCache;
  matn: IdCache;
  hadith: IdCache;
  hadithChain: IdCache;
};

const caches: LookupCaches = {
  authors: new Map(),
  sources: new Map(),
  books: new Map(),
  chapters: new Map(),
  grades: new Map(),
  narrationLevels: new Map(),
  attributionTypes: new Map(),
  chainTypes: new Map(),
  narratorTiers: new Map(),
  reliabilityTiers: new Map(),
  transmissionMethods: new Map(),
  narrators: new Map(),
  matn: new Map(),
  hadith: new Map(),
  hadithChain: new Map(),
};

const isUniqueViolation = (error: unknown) =>
  Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505");

async function insertOrGetExisting(
  client: PoolClient,
  insertSql: string,
  insertParams: unknown[],
  selectSql: string,
  selectParams: unknown[],
) {
  const savepoint = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    const result = await client.query<{ id: number }>(insertSql, insertParams);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return result.rows[0].id;
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (isUniqueViolation(error)) {
      const retry = await client.query<{ id: number }>(selectSql, selectParams);
      if (retry.rowCount) {
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return retry.rows[0].id;
      }
    }
    console.error("[seed] insertOrGetExisting failed", { insertSql, selectSql, error });
    throw error;
  }
}

async function syncSequences(client: PoolClient, tables: string[]) {
  for (const table of tables) {
    await syncSequence(client, table);
  }
}

async function syncSequence(client: PoolClient, table: string, column = "id") {
  try {
    const seqResult = await client.query<{ seq: string | null }>(
      "SELECT pg_get_serial_sequence($1, $2) AS seq",
      [table, column],
    );
    const seq = seqResult.rows[0]?.seq;
    if (!seq) return;
    const maxResult = await client.query<{ max: number | null }>(`SELECT MAX(${column}) AS max FROM ${table}`);
    const max = maxResult.rows[0]?.max ?? 0;
    const nextValue = max > 0 ? max : 1;
    const isCalled = max > 0;
    await client.query("SELECT setval($1, $2, $3)", [seq, nextValue, isCalled]);
  } catch (error) {
    if (!isMissingRelation(error)) {
      throw error;
    }
    console.warn(`[seed] ${table} table not found when syncing sequence; skipping`);
  }
}

async function tableExists(client: PoolClient, table: string) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [table],
  );
  return Boolean(result.rows[0]?.exists);
}

async function getNextManualId(client: PoolClient, table: string) {
  const result = await client.query<{ next: number }>(`SELECT COALESCE(MAX(id), 0) + 1 AS next FROM ${table}`);
  return result.rows[0]?.next ?? 1;
}

async function seedStaticLookups(client: PoolClient) {
  console.log("[seed] syncing sequences and seeding lookup tables");
  await syncSequences(client, [
    "narration_level",
    "attribution_type",
    "chain_type",
    "narrator_tier",
    "reliability_tier",
    "transmission_method",
    "author",
    "source",
    "book",
    "chapter",
    "grade",
    "narrator",
    "matn",
    "hadith",
    "hadith_chain",
    "chain_narrator",
  ]);
  console.log("[seed] seeding narration levels");
  for (const [key, value] of Object.entries(narrationLevelInfo)) {
    await getNarrationLevelId(client, key, value.title, value.secondary, value.description);
  }

  console.log("[seed] seeding attribution types");
  for (const item of sourceTypeInfo) {
    await getAttributionTypeId(client, item.key, item.title, item.secondary, item.description);
  }

  console.log("[seed] seeding chain types");
  for (const item of chainTypeInfo) {
    await getChainTypeId(client, item.key, item.title, item.secondary, item.description);
  }

  console.log("[seed] seeding narrator tiers");
  for (const [key, value] of Object.entries(narratorTierInfo)) {
    await getNarratorTierId(client, key, value.title, value.secondary, value.description);
  }

  console.log("[seed] seeding reliability tiers");
  for (const [key, value] of Object.entries(reliabilityTierInfo)) {
    await getReliabilityTierId(
      client,
      key,
      value.title,
      value.secondary,
      value.description,
      value.background,
      value.color,
    );
  }

  console.log("[seed] seeding transmission methods");
  for (const method of transmissionMethods) {
    await getTransmissionMethodId(client, method.title, method.description);
  }

  const lifespanTableExists = await tableExists(client, "narrator_lifespans");
  if (lifespanTableExists) {
    for (const [name, lifespan] of Object.entries(narratorLifespans)) {
      await client.query(
        `INSERT INTO narrator_lifespans (name, lifespan)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET lifespan = EXCLUDED.lifespan`,
        [name, lifespan],
      );
    }
  } else {
    console.warn("[seed] narrator_lifespans table not found; skipping lifespan seeding");
  }
}

const isMissingRelation = (error: unknown) =>
  Boolean(error && typeof error === "object" && (error as { code?: string }).code === "42P01");

async function getAuthorId(client: PoolClient, sourceName: string) {
  const authorInfo = sourceAuthorMap[sourceName] ?? {
    name: "Unknown Author",
    lifespan: null,
  };
  const cacheKey = authorInfo.name;
  if (caches.authors.has(cacheKey)) {
    return caches.authors.get(cacheKey)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM author WHERE name = $1", [authorInfo.name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO author (name, lifespan_label) VALUES ($1, $2) RETURNING id",
      [authorInfo.name, authorInfo.lifespan ?? null],
    );
    id = result.rows[0].id;
  }
  caches.authors.set(cacheKey, id);
  return id;
}

async function getSourceId(client: PoolClient, sourceName: string) {
  if (caches.sources.has(sourceName)) {
    return caches.sources.get(sourceName)!;
  }
  const authorId = await getAuthorId(client, sourceName);
  const existing = await client.query<{ id: number }>("SELECT id FROM source WHERE name = $1", [sourceName]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO source (name, author_id) VALUES ($1, $2) RETURNING id",
      [sourceName, authorId],
    );
    id = result.rows[0].id;
  }
  caches.sources.set(sourceName, id);
  return id;
}

async function getBookId(client: PoolClient, sourceId: number, bookName?: string, bookNumber?: number) {
  if (!bookName && !bookNumber) return null;
  const cacheKey = `${sourceId}:${bookNumber ?? ""}:${bookName ?? ""}`;
  if (caches.books.has(cacheKey)) {
    return caches.books.get(cacheKey)!;
  }
  let existingId: number | null = null;
  if (bookNumber != null) {
    const existingByNumber = await client.query<{ id: number }>(
      "SELECT id FROM book WHERE source_id = $1 AND number = $2 LIMIT 1",
      [sourceId, bookNumber],
    );
    if (existingByNumber.rowCount) {
      existingId = existingByNumber.rows[0].id;
    }
  }
  if (!existingId && bookName) {
    const existingByName = await client.query<{ id: number }>(
      "SELECT id FROM book WHERE source_id = $1 AND name = $2 LIMIT 1",
      [sourceId, bookName],
    );
    if (existingByName.rowCount) {
      existingId = existingByName.rows[0].id;
    }
  }
  let id: number;
  if (existingId) {
    id = existingId;
    if (bookName) {
      await client.query("UPDATE book SET name = $1 WHERE id = $2 AND (name IS DISTINCT FROM $1)", [bookName, id]);
    }
    if (bookNumber != null) {
      await client.query("UPDATE book SET number = $1 WHERE id = $2 AND (number IS DISTINCT FROM $1)", [bookNumber, id]);
    }
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO book (source_id, name, number) VALUES ($1, $2, $3) RETURNING id",
      [sourceId, bookName ?? null, bookNumber ?? null],
    );
    id = result.rows[0].id;
  }
  caches.books.set(cacheKey, id);
  return id;
}

async function getChapterId(client: PoolClient, bookId: number | null, chapterName?: string) {
  if (!bookId || !chapterName) return null;
  const cacheKey = `${bookId}:${chapterName}`;
  if (caches.chapters.has(cacheKey)) {
    return caches.chapters.get(cacheKey)!;
  }
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM chapter WHERE book_id = $1 AND name = $2 LIMIT 1",
    [bookId, chapterName],
  );
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO chapter (book_id, name) VALUES ($1, $2) RETURNING id",
      [bookId, chapterName],
    );
    id = result.rows[0].id;
  }
  caches.chapters.set(cacheKey, id);
  return id;
}

async function getGradeId(client: PoolClient, gradeName: string) {
  if (caches.grades.has(gradeName)) {
    return caches.grades.get(gradeName)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM grade WHERE name = $1", [gradeName]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const style = getGradingStyle(gradeName);
    const result = await client.query<{ id: number }>(
      "INSERT INTO grade (name, description, background_color, text_color) VALUES ($1, $2, $3, $4) RETURNING id",
      [gradeName, style.description || gradeName, style.background, style.color],
    );
    id = result.rows[0].id;
  }
  caches.grades.set(gradeName, id);
  return id;
}

async function getNarrationLevelId(
  client: PoolClient,
  key: string,
  title: string,
  secondary?: string,
  description?: string,
) {
  if (caches.narrationLevels.has(key)) {
    return caches.narrationLevels.get(key)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM narration_level WHERE name_en = $1", [title]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "narration_level");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO narration_level (id, name_en, name_ar, description) VALUES ($1, $2, $3, $4) RETURNING id",
      [manualId, title, secondary ?? null, description ?? null],
      "SELECT id FROM narration_level WHERE name_en = $1",
      [title],
    );
  }
  caches.narrationLevels.set(key, id);
  return id;
}

async function getAttributionTypeId(
  client: PoolClient,
  key: string,
  title: string,
  secondary?: string,
  description?: string,
) {
  if (caches.attributionTypes.has(key)) {
    return caches.attributionTypes.get(key)!;
  }
  const existing = await client.query<{ id: number }>(
    "SELECT id FROM attribution_type WHERE name_en = $1",
    [title],
  );
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "attribution_type");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO attribution_type (id, name_en, name_ar, description) VALUES ($1, $2, $3, $4) RETURNING id",
      [manualId, title, secondary ?? null, description ?? null],
      "SELECT id FROM attribution_type WHERE name_en = $1",
      [title],
    );
  }
  caches.attributionTypes.set(key, id);
  return id;
}

async function getChainTypeId(
  client: PoolClient,
  key: string,
  title: string,
  secondary?: string,
  description?: string,
) {
  if (caches.chainTypes.has(key)) {
    return caches.chainTypes.get(key)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM chain_type WHERE name_en = $1", [title]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "chain_type");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO chain_type (id, name_en, name_ar, description) VALUES ($1, $2, $3, $4) RETURNING id",
      [manualId, title, secondary ?? null, description ?? null],
      "SELECT id FROM chain_type WHERE name_en = $1",
      [title],
    );
  }
  caches.chainTypes.set(key, id);
  return id;
}

async function getNarratorTierId(
  client: PoolClient,
  key: string,
  title: string,
  secondary?: string,
  description?: string,
) {
  if (caches.narratorTiers.has(key)) {
    return caches.narratorTiers.get(key)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM narrator_tier WHERE name = $1", [title]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "narrator_tier");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO narrator_tier (id, name, secondary_label, description) VALUES ($1, $2, $3, $4) RETURNING id",
      [manualId, title, secondary ?? null, description ?? null],
      "SELECT id FROM narrator_tier WHERE name = $1",
      [title],
    );
  }
  caches.narratorTiers.set(key, id);
  return id;
}

async function getReliabilityTierId(
  client: PoolClient,
  key: string,
  title: string,
  secondary?: string,
  description?: string,
  badgeBackground?: string,
  badgeText?: string,
) {
  if (caches.reliabilityTiers.has(key)) {
    return caches.reliabilityTiers.get(key)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM reliability_tier WHERE name = $1", [title]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "reliability_tier");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO reliability_tier (id, name, secondary_label, description, badge_background, badge_text, connector_color) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [
        manualId,
        title,
        secondary ?? null,
        description ?? null,
        badgeBackground ?? null,
        badgeText ?? null,
        badgeBackground ?? null,
      ],
      "SELECT id FROM reliability_tier WHERE name = $1",
      [title],
    );
  }
  caches.reliabilityTiers.set(key, id);
  return id;
}

async function getTransmissionMethodId(client: PoolClient, title: string, description?: string) {
  if (caches.transmissionMethods.has(title)) {
    return caches.transmissionMethods.get(title)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM transmission_method WHERE name = $1", [title]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const manualId = await getNextManualId(client, "transmission_method");
    id = await insertOrGetExisting(
      client,
      "INSERT INTO transmission_method (id, name, description) VALUES ($1, $2, $3) RETURNING id",
      [manualId, title, description ?? null],
      "SELECT id FROM transmission_method WHERE name = $1",
      [title],
    );
  }
  caches.transmissionMethods.set(title, id);
  return id;
}

async function getNarratorId(client: PoolClient, name: string, descriptor?: string) {
  if (caches.narrators.has(name)) {
    return caches.narrators.get(name)!;
  }
  const lifespan = narratorLifespans[name] ?? null;
  const existing = await client.query<{ id: number }>("SELECT id FROM narrator WHERE name = $1", [name]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>(
      "INSERT INTO narrator (name, descriptor, lifespan) VALUES ($1, $2, $3) RETURNING id",
      [name, descriptor ?? null, lifespan ?? null],
    );
    id = result.rows[0].id;
  }
  caches.narrators.set(name, id);
  return id;
}

async function insertMatn(client: PoolClient, text: string) {
  const cacheKey = text;
  if (caches.matn.has(cacheKey)) {
    return caches.matn.get(cacheKey)!;
  }
  const existing = await client.query<{ id: number }>("SELECT id FROM matn WHERE text_en = $1 LIMIT 1", [text]);
  let id: number;
  if (existing.rowCount) {
    id = existing.rows[0].id;
  } else {
    const result = await client.query<{ id: number }>("INSERT INTO matn (text_en) VALUES ($1) RETURNING id", [text]);
    id = result.rows[0].id;
  }
  caches.matn.set(cacheKey, id);
  return id;
}

async function upsertHadith(client: PoolClient, hadith: HadithInsight) {
  const sourceId = await getSourceId(client, hadith.details.source);
  const bookId = await getBookId(client, sourceId, hadith.details.book, hadith.details.bookNumber);
  const chapterId = await getChapterId(client, bookId, hadith.details.chapter);
  const gradeId = await getGradeId(client, hadith.details.grading);
  const matnId = await insertMatn(client, hadith.matn);
  const hadithNumber = hadith.details.hadithNumber ?? null;

  const hadithCacheKey = `${hadith.details.source}:${hadithNumber ?? ""}:${matnId}`;
  let hadithId = caches.hadith.get(hadithCacheKey);
  if (!hadithId) {
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM hadith WHERE number = $1 AND source_id = $2 LIMIT 1",
      [hadithNumber, sourceId],
    );
    if (existing.rowCount) {
      hadithId = existing.rows[0].id;
      await client.query(
        "UPDATE hadith SET book_id = $1, chapter_id = $2, grade_id = $3, matn_id = $4, location = $5, sanad = $6 WHERE id = $7",
        [bookId, chapterId, gradeId, matnId, hadith.details.location ?? null, hadith.sanad ?? null, hadithId],
      );
    } else {
      const result = await client.query<{ id: number }>(
        `INSERT INTO hadith (number, book_id, chapter_id, source_id, grade_id, matn_id, location, sanad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          hadithNumber,
          bookId,
          chapterId,
          sourceId,
          gradeId,
          matnId,
          hadith.details.location ?? null,
          hadith.sanad ?? null,
        ],
      );
      hadithId = result.rows[0].id;
    }
    caches.hadith.set(hadithCacheKey, hadithId);
  }

  await upsertChain(client, hadith, hadithId!);
}

async function upsertChain(client: PoolClient, hadith: HadithInsight, hadithId: number) {
  const narrationLevelId = hadith.narrationLevel
    ? caches.narrationLevels.get(hadith.narrationLevel) ?? null
    : null;
  const attributionTypeKey = hadith.sourceTypes?.[0];
  const attributionTypeId = attributionTypeKey
    ? caches.attributionTypes.get(attributionTypeKey) ?? null
    : null;
  const chainTypeKey = hadith.chainTypes?.[0];
  const chainTypeId = chainTypeKey ? caches.chainTypes.get(chainTypeKey) ?? null : null;

  const cacheKey = `${hadithId}`;
  let chainId = caches.hadithChain.get(cacheKey);
  if (!chainId) {
    const existing = await client.query<{ id: number }>("SELECT id FROM hadith_chain WHERE hadith_id = $1", [hadithId]);
    if (existing.rowCount) {
      chainId = existing.rows[0].id;
      await client.query(
        "UPDATE hadith_chain SET narration_level_id = $1, chain_type_id = $2, attribution_type_id = $3, is_primary = true WHERE id = $4",
        [narrationLevelId, chainTypeId, attributionTypeId, chainId],
      );
      await client.query("DELETE FROM chain_narrator WHERE chain_id = $1", [chainId]);
    } else {
      const result = await client.query<{ id: number }>(
        `INSERT INTO hadith_chain (hadith_id, narration_level_id, chain_type_id, attribution_type_id, is_primary, label)
         VALUES ($1, $2, $3, $4, true, $5)
         RETURNING id`,
        [hadithId, narrationLevelId, chainTypeId, attributionTypeId, "Primary"],
      );
      chainId = result.rows[0].id;
    }
    caches.hadithChain.set(cacheKey, chainId!);
  }

  await insertChainNarrators(client, chainId!, hadith.chain);
}

async function insertChainNarrators(client: PoolClient, chainId: number, narrators: HadithInsight["chain"]) {
  for (let index = 0; index < narrators.length; index += 1) {
    const node = narrators[index];
    const narratorId = await getNarratorId(client, node.name, node.descriptor);
    const classificationId = node.classification ? caches.narratorTiers.get(node.classification) ?? null : null;
    const reliabilityId = node.reliability ? caches.reliabilityTiers.get(node.reliability) ?? null : null;
    const method = transmissionMethods[index % transmissionMethods.length];
    const methodId = await getTransmissionMethodId(client, method.title, method.description);

    await client.query(
      `INSERT INTO chain_narrator (
        chain_id,
        narrator_id,
        position,
        role,
        descriptor,
        classification_id,
        reliability_id,
        transmission_method_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        chainId,
        narratorId,
        index + 1,
        node.type === "prophet" ? "prophet" : "narrator",
        node.descriptor ?? null,
        classificationId,
        reliabilityId,
        methodId,
      ],
    );
  }
}

async function main() {
  const useTransaction = true;
  const client = await getClient();
  try {
    if (useTransaction) {
      await client.query("BEGIN");
    }
    await seedStaticLookups(client);
    for (const hadith of hadithInsights) {
      await upsertHadith(client, hadith);
    }
    if (useTransaction) {
      await client.query("COMMIT");
    }
    console.log(`Seeded ${hadithInsights.length} hadith records into the database.`);
  } catch (error) {
    if (useTransaction) {
      await client.query("ROLLBACK");
    }
    console.error("Failed to seed hadith data", error);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main();
