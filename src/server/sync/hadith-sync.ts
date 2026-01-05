import { PoolClient } from "pg";
import { getClient, query } from "@/server/db/client";
import { getDriver } from "@/server/graph/client";
import {
  mapAttributionTypeToNode,
  mapBookToNode,
  mapChainToNode,
  mapChainTypeToNode,
  mapChapterToNode,
  mapGradeToNode,
  linkHadithGrade,
  linkGradeToScholar,
  linkHadithIdentifier,
  mapAuthorToNode,
  mapHadithToNode,
  mapIdentifierToNode,
  mapMatnToNode,
  mapNarrationLevelToNode,
  mapNarratorTierToNode,
  mapNarratorToNode,
  mapReliabilityTierToNode,
  mapScholarToNode,
  mapSourceToNode,
  mapTagToNode,
  mapTransmissionMethodToNode,
  linkHadithChapter,
  linkHadithBook,
  linkHadithSource,
  linkSourceAuthor,
  linkBookSource,
  linkChapterBook,
  linkHadithToMatn,
  linkHadithChain,
  linkHadithTag,
  linkStepNarrator,
  linkNarratorTier,
  linkNarratorReliability,
  linkNarratorMethod,
  linkChainNarrationLevel,
  linkChainType,
  linkChainAttribution,
} from "@/server/graph/mappers";
import { GraphNode, GraphRelationship } from "@/server/graph/types";
import { embedHadithBatch } from "@/server/rag/embeddings";

/**
 * Delta sync flow:
 * - Enqueue hadith IDs when admin creates/updates/soft-deletes.
 * - Processor pulls pending rows and, per hadith:
 *   1) refresh Neo4j projection (delete hadith's edges/chains then re-merge fresh data; if soft-deleted, remove node/edges)
 *   2) refresh embedding for the hadith matn (skip if soft-deleted).
 */

type NodeMap = Map<string, GraphNode>;
type RelMap = Map<string, GraphRelationship>;

const addNode = (nodes: NodeMap, node: GraphNode) => {
  if (!nodes.has(node.key)) nodes.set(node.key, node);
};

const addRel = (rels: RelMap, rel: GraphRelationship) => {
  const key = `${rel.type}|${rel.from}|${rel.to}`;
  if (!rels.has(key)) rels.set(key, rel);
};

export async function enqueueHadithSync(
  hadithId: number,
  opts: { graph?: boolean; embedding?: boolean } = {},
) {
  const needsGraph = opts.graph ?? true;
  const needsEmbedding = opts.embedding ?? true;
  const insertNeeds = needsGraph || needsEmbedding;
  if (!insertNeeds) return;
  await query(
    `
      INSERT INTO hadith_sync_queue (hadith_id, needs_graph, needs_embedding)
      VALUES ($1, $2, $3)
      ON CONFLICT (hadith_id)
      DO UPDATE SET
        needs_graph = hadith_sync_queue.needs_graph OR EXCLUDED.needs_graph,
        needs_embedding = hadith_sync_queue.needs_embedding OR EXCLUDED.needs_embedding,
        processed_at = NULL
    `,
    [hadithId, needsGraph, needsEmbedding],
  );
}

async function removeHadithSubgraph(hadithId: number) {
  const session = getDriver().session();
  try {
    // Remove edges for the hadith, and delete chain nodes (assumed unique per hadith). Keep shared nodes (Narrator, Source, Matn).
    await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})
        OPTIONAL MATCH (h)-[r]->()
        DELETE r
      `,
      { hadithId },
    );
    await session.run(
      `
        MATCH (h:Hadith {pgId: $hadithId})-[hc:HAS_CHAIN]->(c:Chain)
        OPTIONAL MATCH (c)-[s:STEP]->()
        DELETE s, hc, c
      `,
      { hadithId },
    );
    // If hadith soft-deleted, remove node entirely.
    const shouldDelete = await query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM hadith WHERE id = $1",
      [hadithId],
    );
    if (shouldDelete.rows[0]?.deleted_at) {
      await session.run("MATCH (h:Hadith {pgId: $hadithId}) DETACH DELETE h", { hadithId });
    }
  } finally {
    await session.close();
  }
}

async function mergeGraph(nodes: GraphNode[], rels: GraphRelationship[]) {
  const driver = getDriver();
  const session = driver.session();
  try {
    const nodesByLabel = nodes.reduce<Map<string, GraphNode[]>>((acc, node) => {
      const list = acc.get(node.label) ?? [];
      list.push(node);
      acc.set(node.label, list);
      return acc;
    }, new Map());
    for (const [label, bucket] of nodesByLabel.entries()) {
      await session.run(
        `
          UNWIND $nodes AS node
          MERGE (n:${label} {key: node.key})
          SET n += node.properties
        `,
        { nodes: bucket },
      );
    }
    const relsByType = rels.reduce<Map<string, GraphRelationship[]>>((acc, rel) => {
      const list = acc.get(rel.type) ?? [];
      list.push(rel);
      acc.set(rel.type, list);
      return acc;
    }, new Map());
    for (const [type, bucket] of relsByType.entries()) {
      await session.run(
        `
          UNWIND $rels AS rel
          MATCH (from {key: rel.from})
          MATCH (to {key: rel.to})
          MERGE (from)-[r:${type}]->(to)
          SET r += coalesce(rel.properties, {})
        `,
        { rels: bucket },
      );
    }
  } finally {
    await session.close();
  }
}

async function fetchGraphDataForHadith(client: PoolClient, hadithId: number) {
  const nodes: NodeMap = new Map();
  const rels: RelMap = new Map();

  const [
    sources,
    authors,
    books,
    chapters,
    narrationLevels,
    chainTypes,
    attributionTypes,
    transmissionMethods,
    reliabilityTiers,
    narratorTiers,
    tags,
    identifiers,
    grades,
    scholars,
    hadithRows,
    matnRows,
    chains,
    chainNarrators,
    hadithTags,
    hadithGrades,
  ] = await Promise.all([
    client.query<{ id: number; name: string; author_id: number | null }>("SELECT id, name, author_id FROM source"),
    client.query<{ id: number; name: string; lifespan_label: string | null }>("SELECT id, name, lifespan_label FROM author"),
    client.query<{ id: number; name: string | null; number: number | null; source_id: number }>(
      "SELECT id, name, number, source_id FROM book",
    ),
    client.query<{ id: number; name: string | null; number: number | null; book_id: number }>(
      "SELECT id, name, number, book_id FROM chapter",
    ),
    client.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
      "SELECT id, name_en, name_ar, description FROM narration_level",
    ),
    client.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
      "SELECT id, name_en, name_ar, description FROM chain_type",
    ),
    client.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
      "SELECT id, name_en, name_ar, description FROM attribution_type",
    ),
    client.query<{
      id: number;
      name: string;
      description: string | null;
      pill_background_light: string | null;
      pill_background_dark: string | null;
    }>("SELECT id, name, description, pill_background_light, pill_background_dark FROM transmission_method"),
    client.query<{
      id: number;
      name: string;
      secondary_label: string | null;
      description: string | null;
      badge_background: string | null;
      badge_text: string | null;
      connector_color: string | null;
    }>("SELECT id, name, secondary_label, description, badge_background, badge_text, connector_color FROM reliability_tier"),
    client.query<{ id: number; name: string; secondary_label: string | null; description: string | null }>(
      "SELECT id, name, secondary_label, description FROM narrator_tier",
    ),
    client.query<{ id: number; name: string }>("SELECT id, name FROM tag"),
    client.query<{
      id: number;
      hadith_id: number;
      scheme_key: string;
      identifier: string;
      notes: string | null;
      is_primary: boolean | null;
    }>("SELECT id, hadith_id, scheme_key, identifier, notes, is_primary FROM hadith_identifier WHERE hadith_id = $1", [hadithId]),
    client.query<{ id: number; name: string; description: string | null; background_color: string | null; text_color: string | null }>(
      "SELECT id, name, description, background_color, text_color FROM grade",
    ),
    client.query<{ id: number; name: string; lifespan_label: string | null }>("SELECT id, name, lifespan_label FROM scholar"),
    client.query<{
      id: number;
      number: number;
      display_number: string | null;
      display_label: string | null;
      source_id: number;
      source_name: string;
      book_id: number | null;
      book_name: string | null;
      chapter_id: number | null;
      chapter_name: string | null;
      matn_id: number;
      location: string | null;
      sanad: string | null;
      matn_text: string;
      deleted_at: Date | null;
    }>(
      `
        SELECT
          h.id,
          h.number,
          h.display_number,
          COALESCE(h.display_number, ('Book ' || COALESCE(b.number::text, h.number::text) || ', Hadith ' || h.number::text)) AS display_label,
          h.source_id,
          s.name AS source_name,
          h.book_id,
          b.name AS book_name,
          h.chapter_id,
          c.name AS chapter_name,
          h.matn_id,
          h.location,
          h.sanad,
          m.text_en AS matn_text,
          h.deleted_at
        FROM hadith h
        JOIN source s ON s.id = h.source_id
        LEFT JOIN book b ON b.id = h.book_id
        LEFT JOIN chapter c ON c.id = h.chapter_id
        JOIN matn m ON m.id = h.matn_id
        WHERE h.id = $1
      `,
      [hadithId],
    ),
    client.query<{ id: number; text_en: string; text_ar: string | null; summary: string | null }>(
      "SELECT id, text_en, text_ar, summary FROM matn WHERE id IN (SELECT matn_id FROM hadith WHERE id = $1)",
      [hadithId],
    ),
    client.query<{
      id: number;
      hadith_id: number;
      narration_level_id: number | null;
      chain_type_id: number | null;
      attribution_type_id: number | null;
      is_primary: boolean | null;
      label: string | null;
      notes: string | null;
    }>(
      "SELECT id, hadith_id, narration_level_id, chain_type_id, attribution_type_id, is_primary, label, notes FROM hadith_chain WHERE hadith_id = $1",
      [hadithId],
    ),
    client.query<{
      chain_id: number;
      position: number;
      role: string | null;
      narrator_id: number;
      narrator_name: string;
      narrator_descriptor: string | null;
      narrator_lifespan: string | null;
      classification_id: number | null;
      classification: string | null;
      reliability_id: number | null;
      reliability: string | null;
      transmission_method_id: number | null;
      transmission_method: string | null;
    }>(
      `
        SELECT
          cn.chain_id,
          cn.position,
          cn.role,
          n.id AS narrator_id,
          n.name AS narrator_name,
          n.descriptor AS narrator_descriptor,
          n.lifespan AS narrator_lifespan,
          cn.classification_id,
          nt.name AS classification,
          cn.reliability_id,
          rt.name AS reliability,
          cn.transmission_method_id,
          tm.name AS transmission_method
        FROM chain_narrator cn
        JOIN narrator n ON n.id = cn.narrator_id
        LEFT JOIN narrator_tier nt ON nt.id = cn.classification_id
        LEFT JOIN reliability_tier rt ON rt.id = cn.reliability_id
        LEFT JOIN transmission_method tm ON tm.id = cn.transmission_method_id
        WHERE cn.chain_id IN (SELECT id FROM hadith_chain WHERE hadith_id = $1)
        ORDER BY cn.chain_id, cn.position
      `,
      [hadithId],
    ),
    client.query<{ hadith_id: number; tag_id: number }>("SELECT hadith_id, tag_id FROM hadith_tag WHERE hadith_id = $1", [hadithId]),
    client.query<{ hadith_id: number; grade_id: number; scholar_id: number; is_primary: boolean | null; notes: string | null }>(
      "SELECT hadith_id, grade_id, scholar_id, is_primary, notes FROM hadith_grade WHERE hadith_id = $1",
      [hadithId],
    ),
  ]);

  if (hadithRows.rowCount === 0) {
    return { nodes: [], rels: [], deleted: false, exists: false };
  }

  const hadith = hadithRows.rows[0];
  const deleted = Boolean(hadith.deleted_at);

  // Lookup nodes
  sources.rows.forEach((row) =>
    addNode(nodes, mapSourceToNode({ pgId: row.id, title: row.name, secondary: null, description: null })),
  );
  authors.rows.forEach((row) =>
    addNode(nodes, mapAuthorToNode({ pgId: row.id, name: row.name, lifespan: row.lifespan_label })),
  );
  books.rows.forEach((row) =>
    addNode(nodes, mapBookToNode({ pgId: row.id, title: row.name ?? "Book", secondary: row.number?.toString() })),
  );
  chapters.rows.forEach((row) =>
    addNode(nodes, mapChapterToNode({ pgId: row.id, title: row.name ?? "Chapter", secondary: row.number?.toString() })),
  );
  narrationLevels.rows.forEach((row) =>
    addNode(
      nodes,
      mapNarrationLevelToNode({
        pgId: row.id,
        title: row.name_en,
        secondary: row.name_ar,
        description: row.description,
      }),
    ),
  );
  chainTypes.rows.forEach((row) =>
    addNode(
      nodes,
      mapChainTypeToNode({
        pgId: row.id,
        title: row.name_en,
        secondary: row.name_ar,
        description: row.description,
      }),
    ),
  );
  attributionTypes.rows.forEach((row) =>
    addNode(
      nodes,
      mapAttributionTypeToNode({
        pgId: row.id,
        title: row.name_en,
        secondary: row.name_ar,
        description: row.description,
      }),
    ),
  );
  transmissionMethods.rows.forEach((row) =>
    addNode(
      nodes,
      mapTransmissionMethodToNode({
        pgId: row.id,
        title: row.name,
        description: row.description,
        pillBackgroundLight: row.pill_background_light,
        pillBackgroundDark: row.pill_background_dark,
      }),
    ),
  );
  reliabilityTiers.rows.forEach((row) =>
    addNode(
      nodes,
      mapReliabilityTierToNode({
        pgId: row.id,
        title: row.name,
        secondary: row.secondary_label,
        description: row.description,
        badgeBackground: row.badge_background,
        badgeTextColor: row.badge_text,
        connectorColor: row.connector_color,
      }),
    ),
  );
  narratorTiers.rows.forEach((row) =>
    addNode(
      nodes,
      mapNarratorTierToNode({
        pgId: row.id,
        title: row.name,
        secondary: row.secondary_label,
        description: row.description,
      }),
    ),
  );
  tags.rows.forEach((row) => addNode(nodes, mapTagToNode({ pgId: row.id, name: row.name })));
  grades.rows.forEach((row) =>
    addNode(
      nodes,
      mapGradeToNode({
        pgId: row.id,
        name: row.name,
        description: row.description,
        backgroundColor: row.background_color,
        textColor: row.text_color,
      }),
    ),
  );
  scholars.rows.forEach((row) => addNode(nodes, mapScholarToNode({ pgId: row.id, name: row.name, lifespan: row.lifespan_label })));

  // Matn
  const matnMap = new Map<number, { pgId: number; textEn: string; textAr?: string | null; summary?: string | null }>();
  matnRows.rows.forEach((row) => {
    const matn = { pgId: row.id, textEn: row.text_en, textAr: row.text_ar, summary: row.summary };
    addNode(nodes, mapMatnToNode(matn));
    matnMap.set(row.id, matn);
  });

  const hadithNode = {
    pgId: hadith.id,
    number: hadith.number,
    displayNumber: hadith.display_number,
    displayLabel: hadith.display_label,
    sourceName: hadith.source_name,
    bookName: hadith.book_name,
    chapterName: hadith.chapter_name,
    matnPreview: hadith.matn_text?.slice(0, 200) ?? null,
    location: hadith.location,
    sanad: hadith.sanad,
  };
  addNode(nodes, mapHadithToNode(hadithNode));

  const matn = matnMap.get(hadith.matn_id);
  if (matn) addRel(rels, linkHadithToMatn(hadithNode, matn));
  const sourceRow = sources.rows.find((s) => s.id === hadith.source_id);
  if (sourceRow) {
    addRel(
      rels,
      linkHadithSource(hadithNode, { pgId: sourceRow.id, title: sourceRow.name, secondary: null, description: null }),
    );
    if (sourceRow.author_id) {
      const authorRow = authors.rows.find((author) => author.id === sourceRow.author_id);
      if (authorRow) {
        addRel(
          rels,
          linkSourceAuthor(
            { pgId: sourceRow.id, title: sourceRow.name, secondary: null, description: null },
            { pgId: authorRow.id, name: authorRow.name, lifespan: authorRow.lifespan_label },
          ),
        );
      }
    }
  }
  const bookRow = books.rows.find((b) => b.id === hadith.book_id);
  if (bookRow) {
    addRel(
      rels,
      linkHadithBook(hadithNode, { pgId: bookRow.id, title: bookRow.name ?? "Book", secondary: bookRow.number?.toString() }),
    );
    const bookSource = sources.rows.find((s) => s.id === bookRow.source_id);
    if (bookSource) {
      addRel(
        rels,
        linkBookSource(
          { pgId: bookRow.id, title: bookRow.name ?? "Book", secondary: bookRow.number?.toString() },
          { pgId: bookSource.id, title: bookSource.name, secondary: null, description: null },
        ),
      );
    }
  }
  const chapterRow = chapters.rows.find((c) => c.id === hadith.chapter_id);
  if (chapterRow) {
    addRel(
      rels,
      linkHadithChapter(hadithNode, {
        pgId: chapterRow.id,
        title: chapterRow.name ?? "Chapter",
        secondary: chapterRow.number?.toString(),
      }),
    );
    const chapterBook = books.rows.find((b) => b.id === chapterRow.book_id);
    if (chapterBook) {
      addRel(
        rels,
        linkChapterBook(
          { pgId: chapterRow.id, title: chapterRow.name ?? "Chapter", secondary: chapterRow.number?.toString() },
          { pgId: chapterBook.id, title: chapterBook.name ?? "Book", secondary: chapterBook.number?.toString() },
        ),
      );
    }
  }

  // Identifiers
  identifiers.rows.forEach((row) => {
    const idNode = {
      pgId: row.id,
      schemeKey: row.scheme_key,
      identifier: row.identifier,
      notes: row.notes,
      isPrimary: row.is_primary,
    };
    addNode(nodes, mapIdentifierToNode(idNode));
    addRel(rels, linkHadithIdentifier(hadithNode, idNode));
  });

  // Tags
  hadithTags.rows.forEach((row) => {
    const tagRow = tags.rows.find((t) => t.id === row.tag_id);
    if (tagRow) addRel(rels, linkHadithTag(hadithNode, { pgId: tagRow.id, name: tagRow.name }));
  });

  // Chains
  const chainMap = new Map<number, { pgId: number; label?: string | null; isPrimary?: boolean | null }>();
  chains.rows.forEach((row) => {
    const node = {
      pgId: row.id,
      label: row.label,
      isPrimary: row.is_primary,
      notes: row.notes,
    };
    addNode(nodes, mapChainToNode(node));
    chainMap.set(row.id, node);
    addRel(rels, linkHadithChain(hadithNode, node));
    if (row.narration_level_id) {
      const nl = narrationLevels.rows.find((n) => n.id === row.narration_level_id);
      if (nl)
        addRel(
          rels,
          linkChainNarrationLevel(node, { pgId: nl.id, title: nl.name_en, secondary: nl.name_ar, description: nl.description }),
        );
    }
    if (row.chain_type_id) {
      const ct = chainTypes.rows.find((c) => c.id === row.chain_type_id);
      if (ct)
        addRel(
          rels,
          linkChainType(node, { pgId: ct.id, title: ct.name_en, secondary: ct.name_ar, description: ct.description }),
        );
    }
    if (row.attribution_type_id) {
      const at = attributionTypes.rows.find((a) => a.id === row.attribution_type_id);
      if (at)
        addRel(
          rels,
          linkChainAttribution(node, { pgId: at.id, title: at.name_en, secondary: at.name_ar, description: at.description }),
        );
    }
  });

  // Narrators + steps
  const narratorMap = new Map<number, { pgId: number; name: string; descriptor?: string | null; lifespan?: string | null }>();
  chainNarrators.rows.forEach((row) => {
    let narrator = narratorMap.get(row.narrator_id);
    if (!narrator) {
      narrator = {
        pgId: row.narrator_id,
        name: row.narrator_name,
        descriptor: row.narrator_descriptor,
        lifespan: row.narrator_lifespan,
      };
      addNode(nodes, mapNarratorToNode(narrator));
      narratorMap.set(row.narrator_id, narrator);
    }
    const chain = chainMap.get(row.chain_id);
    if (!chain) return;
    const step = {
      position: row.position,
      role: row.role,
      classificationId: row.classification_id,
      reliabilityId: row.reliability_id,
      transmissionMethodId: row.transmission_method_id,
      classification: row.classification,
      reliability: row.reliability,
      transmissionMethod: row.transmission_method,
    };
    addRel(rels, linkStepNarrator(chain, narrator, step));

    if (row.classification_id) {
      const tierRow = narratorTiers.rows.find((t) => t.id === row.classification_id);
      if (tierRow)
        addRel(
          rels,
          linkNarratorTier(narrator, {
            pgId: tierRow.id,
            title: tierRow.name,
            secondary: tierRow.secondary_label,
            description: tierRow.description,
          }),
        );
    }
    if (row.reliability_id) {
      const rRow = reliabilityTiers.rows.find((r) => r.id === row.reliability_id);
      if (rRow)
        addRel(
          rels,
          linkNarratorReliability(narrator, {
            pgId: rRow.id,
            title: rRow.name,
            secondary: rRow.secondary_label,
            description: rRow.description,
            badgeBackground: rRow.badge_background,
            badgeTextColor: rRow.badge_text,
            connectorColor: rRow.connector_color,
          }),
        );
    }
    if (row.transmission_method_id) {
      const tRow = transmissionMethods.rows.find((t) => t.id === row.transmission_method_id);
      if (tRow)
        addRel(
          rels,
          linkNarratorMethod(narrator, {
            pgId: tRow.id,
            title: tRow.name,
            description: tRow.description,
            pillBackgroundLight: tRow.pill_background_light,
            pillBackgroundDark: tRow.pill_background_dark,
          }),
        );
    }
  });

  // Grades
  hadithGrades.rows.forEach((row) => {
    const gradeRow = grades.rows.find((g) => g.id === row.grade_id);
    const scholarRow = scholars.rows.find((s) => s.id === row.scholar_id);
    if (gradeRow) {
      const gradeNode = {
        pgId: gradeRow.id,
        name: gradeRow.name,
        description: gradeRow.description,
        backgroundColor: gradeRow.background_color,
        textColor: gradeRow.text_color,
      };
      addRel(rels, linkHadithGrade(hadithNode, gradeNode, row.is_primary, row.notes));
      if (scholarRow) {
        const scholarNode = {
          pgId: scholarRow.id,
          name: scholarRow.name,
          lifespan: scholarRow.lifespan_label,
        };
        addRel(rels, linkGradeToScholar(gradeNode, scholarNode));
      }
    }
  });

  return { nodes: Array.from(nodes.values()), rels: Array.from(rels.values()), deleted, exists: true };
}

async function syncGraphForHadith(hadithId: number) {
  const client = await getClient();
  try {
    const data = await fetchGraphDataForHadith(client, hadithId);
    await removeHadithSubgraph(hadithId);
    if (data.deleted || !data.exists) return;
    await mergeGraph(data.nodes, data.rels);
  } finally {
    client.release();
  }
}

export async function processHadithSyncBatch(limit = 50) {
  const client = await getClient();
  try {
    const { rows } = await client.query<{
      id: number;
      hadith_id: number;
      needs_graph: boolean;
      needs_embedding: boolean;
    }>(
      `
        SELECT id, hadith_id, needs_graph, needs_embedding
        FROM hadith_sync_queue
        WHERE needs_graph = true OR needs_embedding = true
        ORDER BY created_at
        LIMIT $1
      `,
      [limit],
    );

    for (const row of rows) {
      try {
        if (row.needs_graph) {
          await syncGraphForHadith(row.hadith_id);
        }
        if (row.needs_embedding) {
          await embedHadithBatch([row.hadith_id]);
        }
        await client.query(
          `
            UPDATE hadith_sync_queue
            SET needs_graph = false,
                needs_embedding = false,
                processed_at = now()
            WHERE id = $1
          `,
          [row.id],
        );
      } catch (err) {
        console.error("[hadith-sync] failed for hadith", row.hadith_id, err);
        // Leave the row pending; will retry next run.
      }
    }
  } finally {
    client.release();
  }
}
