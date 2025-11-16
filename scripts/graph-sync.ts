import "dotenv/config";
import neo4j from "neo4j-driver";
import {
  mapAttributionTypeToNode,
  mapBookToNode,
  mapChainToNode,
  mapChainTypeToNode,
  mapChapterToNode,
  mapGradeToNode,
  mapHadithToNode,
  mapIdentifierToNode,
  mapMatnToNode,
  mapNarrationLevelToNode,
  mapNarratorToNode,
  mapReliabilityTierToNode,
  mapScholarToNode,
  mapSourceToNode,
  mapTagToNode,
  mapTransmissionMethodToNode,
  mapNarratorTierToNode,
  linkHadithChapter,
  linkHadithBook,
  linkHadithSource,
  linkHadithToMatn,
  linkHadithChain,
  linkStepNarrator,
  linkNarratorTier,
  linkNarratorReliability,
  linkNarratorMethod,
  linkHadithIdentifier,
  linkHadithTag,
  linkHadithGrade,
  linkGradeToScholar,
  linkChainNarrationLevel,
  linkChainType,
  linkChainAttribution,
} from "@/server/graph/mappers";
import {
  GraphNode,
  GraphRelationship,
  HadithNodeProps,
  MatnNodeProps,
  ChainNodeProps,
  NarratorNodeProps,
  StepRelationshipProps,
  GradeNodeProps,
  ScholarNodeProps,
  IdentifierNodeProps,
} from "@/server/graph/types";
import { getClient } from "@/server/db/client";
import { getDriver } from "@/server/graph/client";

/**
 * Full Postgres -> Neo4j projection.
 *
 * Strategy: full rebuild. The script clears all existing nodes/relationships in Neo4j,
 * then recreates them via MERGE using stable keys (`label:pgId`). Safe to rerun anytime.
 *
 * Run with: `npm run graph:sync`
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

async function clearGraph() {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    await session.run("MATCH (n) DETACH DELETE n");
  } finally {
    await session.close();
  }
}

async function mergeNodes(nodesByLabel: Map<string, GraphNode[]>) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    for (const [label, nodes] of nodesByLabel.entries()) {
      if (!nodes.length) continue;
      await session.run(
        `
          UNWIND $nodes AS node
          MERGE (n:${label} {key: node.key})
          SET n += node.properties
        `,
        { nodes },
      );
    }
  } finally {
    await session.close();
  }
}

async function mergeRelationships(relsByType: Map<string, GraphRelationship[]>) {
  const driver = getDriver();
  const session = driver.session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    for (const [type, rels] of relsByType.entries()) {
      if (!rels.length) continue;
      await session.run(
        `
          UNWIND $rels AS rel
          MATCH (from {key: rel.from})
          MATCH (to {key: rel.to})
          MERGE (from)-[r:${type}]->(to)
          SET r += coalesce(rel.properties, {})
        `,
        { rels },
      );
    }
  } finally {
    await session.close();
  }
}

async function loadAndMap() {
  const pg = await getClient();
  try {
    const nodes: NodeMap = new Map();
    const rels: RelMap = new Map();

    // Lookups
    const [sources, books, chapters, narrationLevels, chainTypes, attributionTypes, transmissionMethods, reliabilityTiers, narratorTiers, tags, identifiers, grades, scholars, hadithRows, matnRows, chains, chainNarrators, hadithTags, hadithGrades] =
      await Promise.all([
        pg.query<{ id: number; name: string }>("SELECT id, name FROM source"),
        pg.query<{ id: number; name: string | null; number: number | null; source_id: number }>(
          "SELECT id, name, number, source_id FROM book",
        ),
        pg.query<{ id: number; name: string | null; number: number | null; book_id: number }>(
          "SELECT id, name, number, book_id FROM chapter",
        ),
        pg.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
          "SELECT id, name_en, name_ar, description FROM narration_level",
        ),
        pg.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
          "SELECT id, name_en, name_ar, description FROM chain_type",
        ),
        pg.query<{ id: number; name_en: string; name_ar: string | null; description: string | null }>(
          "SELECT id, name_en, name_ar, description FROM attribution_type",
        ),
        pg.query<{ id: number; name: string; description: string | null; pill_background_light: string | null; pill_background_dark: string | null }>(
          "SELECT id, name, description, pill_background_light, pill_background_dark FROM transmission_method",
        ),
        pg.query<{ id: number; name: string; secondary_label: string | null; description: string | null; badge_background: string | null; badge_text: string | null; connector_color: string | null }>(
          "SELECT id, name, secondary_label, description, badge_background, badge_text, connector_color FROM reliability_tier",
        ),
        pg.query<{ id: number; name: string; secondary_label: string | null; description: string | null }>(
          "SELECT id, name, secondary_label, description FROM narrator_tier",
        ),
        pg.query<{ id: number; name: string }>("SELECT id, name FROM tag"),
        pg.query<{ id: number; hadith_id: number; scheme_key: string; identifier: string; notes: string | null; is_primary: boolean | null }>(
          "SELECT id, hadith_id, scheme_key, identifier, notes, is_primary FROM hadith_identifier",
        ),
        pg.query<{ id: number; name: string; description: string | null; background_color: string | null; text_color: string | null }>(
          "SELECT id, name, description, background_color, text_color FROM grade",
        ),
        pg.query<{ id: number; name: string; lifespan_label: string | null }>(
          "SELECT id, name, lifespan_label FROM scholar",
        ),
        pg.query<{
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
          matn_text: string;
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
            m.text_en AS matn_text
          FROM hadith h
          JOIN source s ON s.id = h.source_id
          LEFT JOIN book b ON b.id = h.book_id
          LEFT JOIN chapter c ON c.id = h.chapter_id
          JOIN matn m ON m.id = h.matn_id
          WHERE h.deleted_at IS NULL
        `,
        ),
        pg.query<{ id: number; text_en: string; text_ar: string | null; summary: string | null }>(
          "SELECT id, text_en, text_ar, summary FROM matn",
        ),
        pg.query<{
          id: number;
          hadith_id: number;
          narration_level_id: number | null;
          chain_type_id: number | null;
          attribution_type_id: number | null;
          is_primary: boolean | null;
          label: string | null;
        }>(
          "SELECT id, hadith_id, narration_level_id, chain_type_id, attribution_type_id, is_primary, label FROM hadith_chain",
        ),
        pg.query<{
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
            ORDER BY cn.chain_id, cn.position
          `,
        ),
        pg.query<{ hadith_id: number; tag_id: number }>("SELECT hadith_id, tag_id FROM hadith_tag"),
        pg.query<{ hadith_id: number; grade_id: number; scholar_id: number; is_primary: boolean | null }>(
          "SELECT hadith_id, grade_id, scholar_id, is_primary FROM hadith_grade",
        ),
      ]);

    // Lookup nodes
    sources.rows.forEach((row) =>
      addNode(nodes, mapSourceToNode({ pgId: row.id, title: row.name, secondary: null, description: null })),
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
    const matnMap = new Map<number, MatnNodeProps>();
    matnRows.rows.forEach((row) => {
      const matn = { pgId: row.id, textEn: row.text_en, textAr: row.text_ar, summary: row.summary } satisfies MatnNodeProps;
      addNode(nodes, mapMatnToNode(matn));
      matnMap.set(row.id, matn);
    });

    // Hadith
    const hadithMap = new Map<number, HadithNodeProps>();
    hadithRows.rows.forEach((row) => {
      const hadith = {
        pgId: row.id,
        number: row.number,
        displayNumber: row.display_number,
        displayLabel: row.display_label,
        sourceName: row.source_name,
        bookName: row.book_name,
        chapterName: row.chapter_name,
        matnPreview: row.matn_text?.slice(0, 200) ?? null,
        location: row.location,
      } satisfies HadithNodeProps;
      addNode(nodes, mapHadithToNode(hadith));
      hadithMap.set(row.id, hadith);

      const matn = matnMap.get(row.matn_id);
      if (matn) addRel(rels, linkHadithToMatn(hadith, matn));

      const sourceNode = sources.rows.find((s) => s.id === row.source_id);
      if (sourceNode)
        addRel(
          rels,
          linkHadithSource(
            hadith,
            { pgId: sourceNode.id, title: sourceNode.name, secondary: null, description: null },
          ),
        );
      const bookNode = books.rows.find((b) => b.id === row.book_id);
      if (bookNode)
        addRel(rels, linkHadithBook(hadith, { pgId: bookNode.id, title: bookNode.name ?? "Book", secondary: bookNode.number?.toString() }));
      const chapterNode = chapters.rows.find((c) => c.id === row.chapter_id);
      if (chapterNode)
        addRel(rels, linkHadithChapter(hadith, { pgId: chapterNode.id, title: chapterNode.name ?? "Chapter", secondary: chapterNode.number?.toString() }));
    });

    // Identifiers
    identifiers.rows.forEach((row) => {
      const idNode: IdentifierNodeProps = {
        pgId: row.id,
        schemeKey: row.scheme_key,
        identifier: row.identifier,
        notes: row.notes,
        isPrimary: row.is_primary,
      };
      addNode(nodes, mapIdentifierToNode(idNode));
      const hadith = hadithMap.get(row.hadith_id);
      if (hadith) addRel(rels, linkHadithIdentifier(hadith, idNode));
    });

    // Tags
    hadithTags.rows.forEach((row) => {
      const hadith = hadithMap.get(row.hadith_id);
      const tagRow = tags.rows.find((t) => t.id === row.tag_id);
      if (hadith && tagRow) addRel(rels, linkHadithTag(hadith, { pgId: tagRow.id, name: tagRow.name }));
    });

    // Chains
    const chainMap = new Map<number, ChainNodeProps>();
    chains.rows.forEach((row) => {
      const node: ChainNodeProps = {
        pgId: row.id,
        label: row.label,
        isPrimary: row.is_primary,
      };
      addNode(nodes, mapChainToNode(node));
      chainMap.set(row.id, node);
      const hadith = hadithMap.get(row.hadith_id);
      if (hadith) addRel(rels, linkHadithChain(hadith, node));

      if (row.narration_level_id) {
        const nl = narrationLevels.rows.find((n) => n.id === row.narration_level_id);
        if (nl)
          addRel(
            rels,
            linkChainNarrationLevel(node, {
              pgId: nl.id,
              title: nl.name_en,
              secondary: nl.name_ar,
              description: nl.description,
            }),
          );
      }
      if (row.chain_type_id) {
        const ct = chainTypes.rows.find((c) => c.id === row.chain_type_id);
        if (ct)
          addRel(
            rels,
            linkChainType(node, {
              pgId: ct.id,
              title: ct.name_en,
              secondary: ct.name_ar,
              description: ct.description,
            }),
          );
      }
      if (row.attribution_type_id) {
        const at = attributionTypes.rows.find((a) => a.id === row.attribution_type_id);
        if (at)
          addRel(
            rels,
            linkChainAttribution(node, {
              pgId: at.id,
              title: at.name_en,
              secondary: at.name_ar,
              description: at.description,
            }),
          );
      }
    });

    // Narrators + steps
    const narratorMap = new Map<number, NarratorNodeProps>();
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
      const step: StepRelationshipProps = {
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
      const hadith = hadithMap.get(row.hadith_id);
      const gradeRow = grades.rows.find((g) => g.id === row.grade_id);
      const scholarRow = scholars.rows.find((s) => s.id === row.scholar_id);
      if (hadith && gradeRow) {
        const gradeNode: GradeNodeProps = {
          pgId: gradeRow.id,
          name: gradeRow.name,
          description: gradeRow.description,
          backgroundColor: gradeRow.background_color,
          textColor: gradeRow.text_color,
        };
        addRel(rels, linkHadithGrade(hadith, gradeNode, row.is_primary));
        if (scholarRow) {
          const scholarNode: ScholarNodeProps = {
            pgId: scholarRow.id,
            name: scholarRow.name,
            lifespan: scholarRow.lifespan_label,
          };
          addRel(rels, linkGradeToScholar(gradeNode, scholarNode));
        }
      }
    });

    return { nodes: Array.from(nodes.values()), rels: Array.from(rels.values()) };
  } finally {
    pg.release();
  }
}

async function main() {
  console.log("[graph-sync] Starting full graph rebuild");
  await clearGraph();
  console.log("[graph-sync] Cleared existing graph");

  const { nodes, rels } = await loadAndMap();
  console.log(`[graph-sync] Mapped ${nodes.length} nodes and ${rels.length} relationships`);

  const nodesByLabel = nodes.reduce<Map<string, GraphNode[]>>((acc, node) => {
    const list = acc.get(node.label) ?? [];
    list.push(node);
    acc.set(node.label, list);
    return acc;
  }, new Map());

  const relsByType = rels.reduce<Map<string, GraphRelationship[]>>((acc, rel) => {
    const list = acc.get(rel.type) ?? [];
    list.push(rel);
    acc.set(rel.type, list);
    return acc;
  }, new Map());

  await mergeNodes(nodesByLabel);
  console.log("[graph-sync] Nodes merged");
  await mergeRelationships(relsByType);
  console.log("[graph-sync] Relationships merged");

  console.log("[graph-sync] Done");
  await getDriver().close();
}

main().catch((error) => {
  console.error("[graph-sync] Failed", error);
  process.exit(1);
});
