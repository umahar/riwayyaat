import { getClient } from "@/server/db/client";
import {
  HadithInsight,
  GradeInfo,
  LookupDetail,
  ReliabilityDetail,
  TransmissionMethodDetail,
  NarrationLevel,
} from "@/features/hadith/types";

type HadithRow = {
  id: number;
  number: number;
  source_name: string;
  book_name: string | null;
  book_number: number | null;
  chapter_name: string | null;
  grade_id: number | null;
  grade_name: string | null;
  grade_description: string | null;
  grade_background: string | null;
  grade_text_color: string | null;
  matn_text: string;
  location: string | null;
  sanad: string | null;
  chain_id: number | null;
  narration_level_id: number | null;
  narration_level_name: string | null;
  narration_level_secondary: string | null;
  narration_level_description: string | null;
  chain_type_id: number | null;
  chain_type_name: string | null;
  chain_type_secondary: string | null;
  chain_type_description: string | null;
  attribution_type_id: number | null;
  attribution_type_name: string | null;
  attribution_type_secondary: string | null;
  attribution_type_description: string | null;
  author_name: string | null;
  author_lifespan: string | null;
  graded_grades: GradedGradeRow[] | null;
};

type GradedGradeRow = {
  scholar_name: string;
  scholar_lifespan: string | null;
  grade_id: number | null;
  grade_name: string | null;
  grade_description: string | null;
  grade_background: string | null;
  grade_text_color: string | null;
  is_primary: boolean | null;
};

type ChainNarratorRow = {
  chain_id: number;
  position: number;
  name: string;
  narrator_descriptor: string | null;
  lifespan: string | null;
  role: string | null;
  tier_id: number | null;
  tier_name: string | null;
  tier_secondary: string | null;
  tier_description: string | null;
  reliability_id: number | null;
  reliability_name: string | null;
  reliability_secondary: string | null;
  reliability_description: string | null;
  reliability_badge_background: string | null;
  reliability_badge_text: string | null;
  reliability_connector_color: string | null;
  method_id: number | null;
  method_name: string | null;
  method_description: string | null;
  method_pill_light: string | null;
  method_pill_dark: string | null;
};

const DEFAULT_BOOK = "General Collection";
const DEFAULT_CHAPTER = "General Chapter";
const DEFAULT_GRADE = "Unspecified";
const DEFAULT_LOCATION_PREFIX = "Hadith";
export async function listHadithInsights(): Promise<HadithInsight[]> {
  return fetchHadiths();
}

export async function getHadithById(id: string): Promise<HadithInsight | null> {
  const numericId = Number(id);
  if (Number.isNaN(numericId)) {
    return null;
  }
  const [record] = await fetchHadiths("WHERE h.id = $1", [numericId]);
  return record ?? null;
}

async function fetchHadiths(whereClause = "", params: unknown[] = []): Promise<HadithInsight[]> {
  const client = await getClient();
  try {
    const { rows } = await client.query<HadithRow>(
      `
        SELECT
          h.id,
          h.number,
          s.name AS source_name,
          b.name AS book_name,
          b.number AS book_number,
          c.name AS chapter_name,
          g.id AS grade_id,
          g.name AS grade_name,
          g.description AS grade_description,
          g.background_color AS grade_background,
          g.text_color AS grade_text_color,
          m.text_en AS matn_text,
          h.location,
          h.sanad,
          hc.id AS chain_id,
          nl.id AS narration_level_id,
          nl.name_en AS narration_level_name,
          nl.name_ar AS narration_level_secondary,
          nl.description AS narration_level_description,
          ct.id AS chain_type_id,
          ct.name_en AS chain_type_name,
          ct.name_ar AS chain_type_secondary,
          ct.description AS chain_type_description,
          at.id AS attribution_type_id,
          at.name_en AS attribution_type_name,
          at.name_ar AS attribution_type_secondary,
          at.description AS attribution_type_description,
          a.name AS author_name,
          a.lifespan_label AS author_lifespan,
          grades.rollup AS graded_grades
        FROM hadith h
        JOIN source s ON s.id = h.source_id
        LEFT JOIN author a ON a.id = s.author_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        LEFT JOIN grade g ON g.id = h.grade_id
        JOIN matn m ON m.id = h.matn_id
        LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id AND hc.is_primary = true
        LEFT JOIN narration_level nl ON nl.id = hc.narration_level_id
        LEFT JOIN chain_type ct ON ct.id = hc.chain_type_id
        LEFT JOIN attribution_type at ON at.id = hc.attribution_type_id
        LEFT JOIN LATERAL (
          SELECT json_agg(
                   json_build_object(
                     'scholar_name', sc.name,
                     'scholar_lifespan', sc.lifespan_label,
                     'grade_id', g.id,
                     'grade_name', g.name,
                     'grade_description', g.description,
                     'grade_background', g.background_color,
                     'grade_text_color', g.text_color,
                     'is_primary', hg.is_primary
                   )
                   ORDER BY hg.is_primary DESC, sc.name
                 ) AS rollup
          FROM hadith_grade hg
          JOIN scholar sc ON sc.id = hg.scholar_id
          JOIN grade g ON g.id = hg.grade_id
          WHERE hg.hadith_id = h.id
        ) AS grades ON TRUE
        ${whereClause}
        ORDER BY h.id
      `,
      params,
    );
    const chainIds = Array.from(
      new Set(rows.map((row) => row.chain_id).filter((id): id is number => Boolean(id))),
    );
    const narratorsByChain = chainIds.length
      ? await fetchChainNarrators(client, chainIds)
      : new Map<number, ChainNarratorRow[]>();
    return rows.map((row) => mapHadithRow(row, narratorsByChain));
  } finally {
    client.release();
  }
}

async function fetchChainNarrators(client: Awaited<ReturnType<typeof getClient>>, chainIds: number[]) {
  const { rows } = await client.query<ChainNarratorRow>(
    `
      SELECT
        cn.chain_id,
        cn.position,
        n.name,
        n.descriptor AS narrator_descriptor,
        n.lifespan AS lifespan,
        cn.role,
        nt.id AS tier_id,
        nt.name AS tier_name,
        nt.secondary_label AS tier_secondary,
        nt.description AS tier_description,
        rt.id AS reliability_id,
        rt.name AS reliability_name,
        rt.secondary_label AS reliability_secondary,
        rt.description AS reliability_description,
        rt.badge_background AS reliability_badge_background,
        rt.badge_text AS reliability_badge_text,
        rt.connector_color AS reliability_connector_color,
        tm.id AS method_id,
        tm.name AS method_name,
        tm.description AS method_description,
        tm.pill_background_light AS method_pill_light,
        tm.pill_background_dark AS method_pill_dark
      FROM chain_narrator cn
      JOIN narrator n ON n.id = cn.narrator_id
      LEFT JOIN narrator_tier nt ON nt.id = cn.classification_id
      LEFT JOIN reliability_tier rt ON rt.id = cn.reliability_id
      LEFT JOIN transmission_method tm ON tm.id = cn.transmission_method_id
      WHERE cn.chain_id = ANY($1::int[])
      ORDER BY cn.chain_id, cn.position
    `,
    [chainIds],
  );
  return rows.reduce<Map<number, ChainNarratorRow[]>>((acc, row) => {
    const next = acc.get(row.chain_id) ?? [];
    next.push(row);
    acc.set(row.chain_id, next);
    return acc;
  }, new Map());
}

function mapHadithRow(
  row: HadithRow,
  narratorsByChain: Map<number, ChainNarratorRow[]>,
): HadithInsight {
  const chainRows = row.chain_id ? narratorsByChain.get(row.chain_id) ?? [] : [];
  const gradedGrades = mapGradedGrades(row.graded_grades);
  const gradeInfo = gradedGrades.find((entry) => entry.isPrimary)?.grade ?? buildGradeInfo(row);
  const gradedBy = mapGradedBy(gradedGrades, row.author_name, row.author_lifespan);
  const narrationLevelDetail = buildLookupDetail(
    row.narration_level_id,
    row.narration_level_name,
    row.narration_level_secondary,
    row.narration_level_description,
  );
  const chainTypeDetail = buildLookupDetail(
    row.chain_type_id,
    row.chain_type_name,
    row.chain_type_secondary,
    row.chain_type_description,
  );
  const attributionDetail = buildLookupDetail(
    row.attribution_type_id,
    row.attribution_type_name,
    row.attribution_type_secondary,
    row.attribution_type_description,
  );
  return {
    id: String(row.id),
    matn: row.matn_text,
    sanad: row.sanad ?? "",
    details: {
      source: row.source_name,
      book: row.book_name ?? DEFAULT_BOOK,
      bookNumber: row.book_number ?? row.number,
      chapter: row.chapter_name ?? DEFAULT_CHAPTER,
      grading: row.grade_name ?? DEFAULT_GRADE,
      gradeInfo,
      hadithNumber: row.number,
      location: row.location ?? `${DEFAULT_LOCATION_PREFIX} ${row.number}`,
      author: row.author_name
        ? { name: row.author_name, lifespan: row.author_lifespan ?? undefined }
        : undefined,
    },
    gradedBy,
    gradedGrades,
    chain: mapChainNodes(chainRows),
    sourceTypes: attributionDetail ? [attributionDetail.title] : [],
    sourceTypeDetails: attributionDetail ? [attributionDetail] : undefined,
    chainTypes: chainTypeDetail ? [chainTypeDetail.title] : [],
    chainTypeDetails: chainTypeDetail ? [chainTypeDetail] : undefined,
    narrationLevel: mapNarrationLevelSlug(row.narration_level_name),
    narrationLevelDetail: narrationLevelDetail ?? undefined,
  };
}

function mapChainNodes(rows: ChainNarratorRow[] = []): HadithInsight["chain"] {
  return rows.map((row) => ({
    name: row.name,
    descriptor: row.narrator_descriptor ?? undefined,
    lifespan: row.lifespan ?? undefined,
    type: row.role === "prophet" ? "prophet" : undefined,
    classificationDetail: buildLookupDetail(row.tier_id, row.tier_name, row.tier_secondary, row.tier_description),
    reliabilityDetail: buildReliabilityDetail(row),
    transmissionMethodDetail: buildTransmissionDetail(row),
  }));
}

function mapGradedGrades(rows: GradedGradeRow[] | null): HadithInsight["gradedGrades"] {
  const mapped = (rows ?? []).map((row) => ({
    scholar: {
      name: row.scholar_name,
      lifespan: row.scholar_lifespan ?? undefined,
      isPrimary: row.is_primary ?? undefined,
    },
    grade:
      row.grade_id && row.grade_name
        ? {
            id: row.grade_id,
            title: row.grade_name,
            description: row.grade_description ?? undefined,
            backgroundColor: row.grade_background ?? undefined,
            textColor: row.grade_text_color ?? undefined,
          }
        : undefined,
    isPrimary: row.is_primary ?? undefined,
  }));
  return mapped.filter((item) => item.grade) as HadithInsight["gradedGrades"];
}

function mapGradedBy(
  gradedGrades: HadithInsight["gradedGrades"],
  authorName?: string | null,
  authorLifespan?: string | null,
): HadithInsight["gradedBy"] {
  const mapped =
    gradedGrades?.map((grader) => ({
      name: grader.scholar.name,
      lifespan: grader.scholar.lifespan,
      isPrimary: grader.isPrimary,
    })) ?? [];
  if (mapped.length === 0 && authorName) {
    mapped.push({
      name: authorName,
      lifespan: authorLifespan ?? undefined,
    });
  }
  return mapped.length ? mapped : undefined;
}

function buildLookupDetail(
  id?: number | null,
  title?: string | null,
  secondary?: string | null,
  description?: string | null,
): LookupDetail | undefined {
  if (!id || !title) return undefined;
  return {
    id,
    title,
    secondary: secondary ?? undefined,
    description: description ?? undefined,
  };
}

function buildGradeInfo(row: HadithRow): GradeInfo | undefined {
  if (!row.grade_id || !row.grade_name) return undefined;
  return {
    id: row.grade_id,
    title: row.grade_name,
    description: row.grade_description ?? undefined,
    backgroundColor: row.grade_background ?? undefined,
    textColor: row.grade_text_color ?? undefined,
  };
}

function buildReliabilityDetail(row: ChainNarratorRow): ReliabilityDetail | undefined {
  if (!row.reliability_id || !row.reliability_name) return undefined;
  return {
    id: row.reliability_id,
    title: row.reliability_name,
    secondary: row.reliability_secondary ?? undefined,
    description: row.reliability_description ?? undefined,
    badgeBackground: row.reliability_badge_background ?? undefined,
    badgeTextColor: row.reliability_badge_text ?? undefined,
    connectorColor: row.reliability_connector_color ?? undefined,
  };
}

function buildTransmissionDetail(row: ChainNarratorRow): TransmissionMethodDetail | undefined {
  if (!row.method_id || !row.method_name) return undefined;
  return {
    id: row.method_id,
    title: row.method_name,
    description: row.method_description ?? undefined,
    pillBackgroundLight: row.method_pill_light ?? undefined,
    pillBackgroundDark: row.method_pill_dark ?? undefined,
  };
}

function normalizeLabel(value?: string | null) {
  return value
    ?.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapNarrationLevelSlug(value?: string | null): NarrationLevel {
  const normalized = normalizeLabel(value);
  switch (normalized) {
    case "mutawatir":
      return "mutawatir";
    case "mashhur":
      return "mashhur";
    case "aziz":
      return "aziz";
    case "gharib":
      return "gharib";
    case "fard":
    default:
      return "fard";
  }
}

export const hadithService = {
  listHadithInsights,
  getHadithById,
};
