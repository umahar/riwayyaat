// Hint for Next.js; skipped when running in script contexts (tsx/node).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-extraneous-dependencies
  require("server-only");
} catch {
  /* noop */
}
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
  TagNodeProps,
  LookupNodeProps,
} from "./types";

const key = (label: string, pgId: number) => `${label}:${pgId}`;

// Hadith and matn
export function mapHadithToNode(props: HadithNodeProps): GraphNode<"Hadith", HadithNodeProps> {
  return { label: "Hadith", key: key("Hadith", props.pgId), properties: props };
}

export function mapMatnToNode(props: MatnNodeProps): GraphNode<"Matn", MatnNodeProps> {
  return { label: "Matn", key: key("Matn", props.pgId), properties: props };
}

export function linkHadithToMatn(hadith: HadithNodeProps, matn: MatnNodeProps): GraphRelationship<"HAS_MATN"> {
  return { type: "HAS_MATN", from: key("Hadith", hadith.pgId), to: key("Matn", matn.pgId) };
}

// Source, book, chapter
export function mapSourceToNode(props: LookupNodeProps): GraphNode<"Source", LookupNodeProps> {
  return { label: "Source", key: key("Source", props.pgId), properties: props };
}

export function mapBookToNode(props: LookupNodeProps): GraphNode<"Book", LookupNodeProps> {
  return { label: "Book", key: key("Book", props.pgId), properties: props };
}

export function mapChapterToNode(props: LookupNodeProps): GraphNode<"Chapter", LookupNodeProps> {
  return { label: "Chapter", key: key("Chapter", props.pgId), properties: props };
}

export function linkHadithSource(hadith: HadithNodeProps, source: LookupNodeProps): GraphRelationship<"FROM_SOURCE"> {
  return { type: "FROM_SOURCE", from: key("Hadith", hadith.pgId), to: key("Source", source.pgId) };
}

export function linkHadithBook(hadith: HadithNodeProps, book: LookupNodeProps): GraphRelationship<"IN_BOOK"> {
  return { type: "IN_BOOK", from: key("Hadith", hadith.pgId), to: key("Book", book.pgId) };
}

export function linkHadithChapter(
  hadith: HadithNodeProps,
  chapter: LookupNodeProps,
): GraphRelationship<"IN_CHAPTER"> {
  return { type: "IN_CHAPTER", from: key("Hadith", hadith.pgId), to: key("Chapter", chapter.pgId) };
}

// Chains
export function mapChainToNode(props: ChainNodeProps): GraphNode<"Chain", ChainNodeProps> {
  return { label: "Chain", key: key("Chain", props.pgId), properties: props };
}

export function linkHadithChain(
  hadith: HadithNodeProps,
  chain: ChainNodeProps,
): GraphRelationship<"HAS_CHAIN", { isPrimary?: boolean | null; label?: string | null }> {
  return {
    type: "HAS_CHAIN",
    from: key("Hadith", hadith.pgId),
    to: key("Chain", chain.pgId),
    properties: { isPrimary: chain.isPrimary ?? undefined, label: chain.label ?? undefined },
  };
}

// Lookups
export function mapNarrationLevelToNode(props: LookupNodeProps): GraphNode<"NarrationLevel", LookupNodeProps> {
  return { label: "NarrationLevel", key: key("NarrationLevel", props.pgId), properties: props };
}

export function mapChainTypeToNode(props: LookupNodeProps): GraphNode<"ChainType", LookupNodeProps> {
  return { label: "ChainType", key: key("ChainType", props.pgId), properties: props };
}

export function mapAttributionTypeToNode(props: LookupNodeProps): GraphNode<"AttributionType", LookupNodeProps> {
  return { label: "AttributionType", key: key("AttributionType", props.pgId), properties: props };
}

export function mapTransmissionMethodToNode(
  props: LookupNodeProps,
): GraphNode<"TransmissionMethod", LookupNodeProps> {
  return { label: "TransmissionMethod", key: key("TransmissionMethod", props.pgId), properties: props };
}

export function mapReliabilityTierToNode(props: LookupNodeProps): GraphNode<"ReliabilityTier", LookupNodeProps> {
  return { label: "ReliabilityTier", key: key("ReliabilityTier", props.pgId), properties: props };
}

export function mapNarratorTierToNode(props: LookupNodeProps): GraphNode<"NarratorTier", LookupNodeProps> {
  return { label: "NarratorTier", key: key("NarratorTier", props.pgId), properties: props };
}

export function linkChainNarrationLevel(
  chain: ChainNodeProps,
  level: LookupNodeProps,
): GraphRelationship<"NARRATION_LEVEL"> {
  return { type: "NARRATION_LEVEL", from: key("Chain", chain.pgId), to: key("NarrationLevel", level.pgId) };
}

export function linkChainType(chain: ChainNodeProps, typeNode: LookupNodeProps): GraphRelationship<"CHAIN_TYPE"> {
  return { type: "CHAIN_TYPE", from: key("Chain", chain.pgId), to: key("ChainType", typeNode.pgId) };
}

export function linkChainAttribution(
  chain: ChainNodeProps,
  attribution: LookupNodeProps,
): GraphRelationship<"ATTRIBUTION_TYPE"> {
  return { type: "ATTRIBUTION_TYPE", from: key("Chain", chain.pgId), to: key("AttributionType", attribution.pgId) };
}

// Narrators and steps
export function mapNarratorToNode(props: NarratorNodeProps): GraphNode<"Narrator", NarratorNodeProps> {
  return { label: "Narrator", key: key("Narrator", props.pgId), properties: props };
}

export function linkStepNarrator(
  chain: ChainNodeProps,
  narrator: NarratorNodeProps,
  step: StepRelationshipProps,
): GraphRelationship<"STEP", StepRelationshipProps> {
  return {
    type: "STEP",
    from: key("Chain", chain.pgId),
    to: key("Narrator", narrator.pgId),
    properties: step,
  };
}

export function linkNarratorTier(
  narrator: NarratorNodeProps,
  tier: LookupNodeProps,
): GraphRelationship<"TIER"> {
  return { type: "TIER", from: key("Narrator", narrator.pgId), to: key("NarratorTier", tier.pgId) };
}

export function linkNarratorReliability(
  narrator: NarratorNodeProps,
  reliability: LookupNodeProps,
): GraphRelationship<"RELIABILITY"> {
  return { type: "RELIABILITY", from: key("Narrator", narrator.pgId), to: key("ReliabilityTier", reliability.pgId) };
}

export function linkNarratorMethod(
  narrator: NarratorNodeProps,
  method: LookupNodeProps,
): GraphRelationship<"HAS_METHOD"> {
  return { type: "HAS_METHOD", from: key("Narrator", narrator.pgId), to: key("TransmissionMethod", method.pgId) };
}

// Tags and identifiers
export function mapTagToNode(props: TagNodeProps): GraphNode<"Tag", TagNodeProps> {
  return { label: "Tag", key: key("Tag", props.pgId), properties: props };
}

export function linkHadithTag(hadith: HadithNodeProps, tag: TagNodeProps): GraphRelationship<"TAGGED"> {
  return { type: "TAGGED", from: key("Hadith", hadith.pgId), to: key("Tag", tag.pgId) };
}

export function mapIdentifierToNode(props: IdentifierNodeProps): GraphNode<"Identifier", IdentifierNodeProps> {
  return { label: "Identifier", key: key("Identifier", props.pgId), properties: props };
}

export function linkHadithIdentifier(
  hadith: HadithNodeProps,
  identifier: IdentifierNodeProps,
): GraphRelationship<"IDENTIFIED_AS", { schemeKey: string; identifier: string; isPrimary?: boolean | null; notes?: string | null }> {
  return {
    type: "IDENTIFIED_AS",
    from: key("Hadith", hadith.pgId),
    to: key("Identifier", identifier.pgId),
    properties: {
      schemeKey: identifier.schemeKey,
      identifier: identifier.identifier,
      isPrimary: identifier.isPrimary ?? undefined,
      notes: identifier.notes ?? undefined,
    },
  };
}

// Grades and scholars
export function mapGradeToNode(props: GradeNodeProps): GraphNode<"Grade", GradeNodeProps> {
  return { label: "Grade", key: key("Grade", props.pgId), properties: props };
}

export function mapScholarToNode(props: ScholarNodeProps): GraphNode<"Scholar", ScholarNodeProps> {
  return { label: "Scholar", key: key("Scholar", props.pgId), properties: props };
}

export function linkHadithGrade(
  hadith: HadithNodeProps,
  grade: GradeNodeProps,
  isPrimary?: boolean | null,
): GraphRelationship<"GRADED", { isPrimary?: boolean | null }> {
  return {
    type: "GRADED",
    from: key("Hadith", hadith.pgId),
    to: key("Grade", grade.pgId),
    properties: { isPrimary: isPrimary ?? undefined },
  };
}

export function linkGradeToScholar(
  grade: GradeNodeProps,
  scholar: ScholarNodeProps,
): GraphRelationship<"BY"> {
  return { type: "BY", from: key("Grade", grade.pgId), to: key("Scholar", scholar.pgId) };
}
