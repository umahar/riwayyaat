import { getClient } from "@/server/db/client";

export type StructuredSearchFilters = {
  source?: string;
  book?: string;
  chapter?: string;
  tag?: string;
  grade?: string;
  scholar?: string;
  identifier?: string;
  attribution?: string;
  chainType?: string;
  narrationLevel?: string;
  transmissionMethod?: string;
  narrator?: string;
  sanad?: string;
  matn?: string;
};

const FILTER_PATTERNS: Array<[keyof StructuredSearchFilters, RegExp]> = [
  ["source", /\bsource\s*[:=]\s*([^,;.]+)/i],
  ["book", /\bbook\s*[:=]\s*([^,;.]+)/i],
  ["chapter", /\bchapter\s*[:=]\s*([^,;.]+)/i],
  ["tag", /\btag\s*[:=]\s*([^,;.]+)/i],
  ["grade", /\bgrade\s*[:=]\s*([^,;.]+)/i],
  ["scholar", /\bscholar\s*[:=]\s*([^,;.]+)/i],
  ["identifier", /\bidentifier\s*[:=]\s*([^,;.]+)/i],
  ["attribution", /\battribution\s*[:=]\s*([^,;.]+)/i],
  ["chainType", /\bchain\s*type\s*[:=]\s*([^,;.]+)/i],
  ["narrationLevel", /\bnarration\s*level\s*[:=]\s*([^,;.]+)/i],
  ["transmissionMethod", /\btransmission\s*method\s*[:=]\s*([^,;.]+)/i],
  ["narrator", /\bnarrator\s*[:=]\s*([^,;.]+)/i],
  ["sanad", /\bsanad\s*[:=]\s*([^,;.]+)/i],
  ["matn", /\bmatn\s*[:=]\s*([^,;.]+)/i],
];

export function extractStructuredFilters(question: string): {
  filters: StructuredSearchFilters;
  hasExplicitFilters: boolean;
} {
  const filters: StructuredSearchFilters = {};
  let hasExplicitFilters = false;
  for (const [key, pattern] of FILTER_PATTERNS) {
    const match = question.match(pattern);
    if (!match?.[1]) continue;
    const value = match[1].trim();
    if (!value) continue;
    filters[key] = value;
    hasExplicitFilters = true;
  }
  return { filters, hasExplicitFilters };
}

type SearchParams = {
  text?: string;
  filters?: StructuredSearchFilters;
  limit?: number;
};

const MIN_QUERY_LENGTH = 3;

function pushFilterClause(
  clauses: string[],
  params: unknown[],
  value?: string,
  sql?: string,
) {
  if (!value || !sql) return;
  params.push(`%${value}%`);
  clauses.push(sql.replace(/\$\$/g, `$${params.length}`));
}

export async function searchHadithIdsByQuery(params: SearchParams): Promise<number[]> {
  const clauses: string[] = ["h.deleted_at IS NULL"];
  const values: unknown[] = [];
  const limit = params.limit && params.limit > 0 ? Math.min(Math.trunc(params.limit), 50) : 20;

  const filters = params.filters ?? {};
  const hasFilterValues = Object.values(filters).some((value) => Boolean(value));
  if (!params.text && !hasFilterValues) {
    return [];
  }
  pushFilterClause(clauses, values, filters.source, "s.name ILIKE $$");
  pushFilterClause(clauses, values, filters.book, "b.name ILIKE $$");
  pushFilterClause(clauses, values, filters.chapter, "c.name ILIKE $$");
  pushFilterClause(clauses, values, filters.tag, "t.name ILIKE $$");
  pushFilterClause(clauses, values, filters.grade, "g.name ILIKE $$");
  pushFilterClause(clauses, values, filters.scholar, "sc.name ILIKE $$");
  pushFilterClause(
    clauses,
    values,
    filters.identifier,
    "(hi.scheme_key ILIKE $$ OR hi.identifier ILIKE $$ OR hi.notes ILIKE $$)",
  );
  pushFilterClause(
    clauses,
    values,
    filters.attribution,
    "(at.name_en ILIKE $$ OR at.name_ar ILIKE $$ OR at.description ILIKE $$)",
  );
  pushFilterClause(
    clauses,
    values,
    filters.chainType,
    "(ct.name_en ILIKE $$ OR ct.name_ar ILIKE $$ OR ct.description ILIKE $$)",
  );
  pushFilterClause(
    clauses,
    values,
    filters.narrationLevel,
    "(nl.name_en ILIKE $$ OR nl.name_ar ILIKE $$ OR nl.description ILIKE $$)",
  );
  pushFilterClause(clauses, values, filters.transmissionMethod, "(tm.name ILIKE $$ OR tm.description ILIKE $$)");
  pushFilterClause(clauses, values, filters.narrator, "(n.name ILIKE $$ OR n.descriptor ILIKE $$)");
  pushFilterClause(clauses, values, filters.sanad, "h.sanad ILIKE $$");
  pushFilterClause(clauses, values, filters.matn, "(m.text_en ILIKE $$ OR m.text_ar ILIKE $$ OR m.summary ILIKE $$)");

  if (params.text && params.text.trim().length >= MIN_QUERY_LENGTH) {
    const text = params.text.trim();
    values.push(text);
    const tsIdx = values.length;
    values.push(`%${text}%`);
    const likeIdx = values.length;
    clauses.push(
      `(
        m.matn_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR s.source_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR b.book_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR c.chapter_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR n.narrator_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR t.tag_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR g.grade_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR sc.scholar_search @@ websearch_to_tsquery('english', $${tsIdx})
        OR m.text_en ILIKE $${likeIdx}
        OR m.text_ar ILIKE $${likeIdx}
        OR m.summary ILIKE $${likeIdx}
        OR h.sanad ILIKE $${likeIdx}
        OR h.location ILIKE $${likeIdx}
        OR hi.scheme_key ILIKE $${likeIdx}
        OR hi.identifier ILIKE $${likeIdx}
        OR hi.notes ILIKE $${likeIdx}
      )`,
    );
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const sql = `
    SELECT DISTINCT h.id
    FROM hadith h
    JOIN matn m ON m.id = h.matn_id
    JOIN source s ON s.id = h.source_id
    LEFT JOIN author a ON a.id = s.author_id
    LEFT JOIN book b ON b.id = h.book_id
    LEFT JOIN chapter c ON c.id = h.chapter_id
    LEFT JOIN hadith_tag ht ON ht.hadith_id = h.id
    LEFT JOIN tag t ON t.id = ht.tag_id
    LEFT JOIN hadith_grade hg ON hg.hadith_id = h.id
    LEFT JOIN grade g ON g.id = hg.grade_id
    LEFT JOIN scholar sc ON sc.id = hg.scholar_id
    LEFT JOIN hadith_identifier hi ON hi.hadith_id = h.id
    LEFT JOIN hadith_chain hc ON hc.hadith_id = h.id
    LEFT JOIN attribution_type at ON at.id = hc.attribution_type_id
    LEFT JOIN chain_type ct ON ct.id = hc.chain_type_id
    LEFT JOIN narration_level nl ON nl.id = hc.narration_level_id
    LEFT JOIN chain_narrator cn ON cn.chain_id = hc.id
    LEFT JOIN narrator n ON n.id = cn.narrator_id
    LEFT JOIN narrator_tier nt ON nt.id = cn.classification_id
    LEFT JOIN reliability_tier rt ON rt.id = cn.reliability_id
    LEFT JOIN transmission_method tm ON tm.id = cn.transmission_method_id
    ${whereClause}
    ORDER BY h.id
    LIMIT ${limit}
  `;

  const client = await getClient();
  try {
    const { rows } = await client.query<{ id: number }>(sql, values);
    return rows.map((row) => row.id);
  } finally {
    client.release();
  }
}
