/**
 * Neo4j graph model (conceptual schema)
 *
 * Node labels:
 * - Hadith: { pgId, number, displayNumber, displayLabel, sourceName, bookName, chapterName, matnPreview, location }
 * - Matn: { pgId, textEn, textAr?, summary? }
 * - Source: { pgId, name }
 * - Author: { pgId, name, lifespan? }
 * - Book: { pgId, name, number, sourceName }
 * - Chapter: { pgId, name, number, bookName }
 * - Chain: { pgId, label, isPrimary, narrationLevel?, chainType?, attributionType? }
 * - Narrator: { pgId, name, descriptor?, lifespan? }
 * - Scholar: { pgId, name, lifespan? }
 * - Grade: { pgId, name, description?, backgroundColor?, textColor? }
 * - Tag: { pgId, name }
 * - Identifier: { pgId, schemeKey, identifier, notes?, isPrimary? }
 * - NarrationLevel: { pgId, title, secondary?, description? }
 * - ChainType: { pgId, title, secondary?, description? }
 * - AttributionType: { pgId, title, secondary?, description? }
 * - TransmissionMethod: { pgId, title, description?, pillBackgroundLight?, pillBackgroundDark? }
 * - ReliabilityTier: { pgId, title, secondary?, description?, badgeBackground?, badgeTextColor?, connectorColor? }
 * - NarratorTier: { pgId, title, secondary?, description? }
 *
 * Relationship types (direction: LEFT -> RIGHT):
 * - Hadith -[:HAS_MATN]-> Matn
 * - Hadith -[:FROM_SOURCE]-> Source
 * - Hadith -[:IN_BOOK]-> Book
 * - Hadith -[:IN_CHAPTER]-> Chapter
 * - Source -[:BY_AUTHOR]-> Author
 * - Book -[:BELONGS_TO]-> Source
 * - Chapter -[:BELONGS_TO]-> Book
 * - Hadith -[:HAS_CHAIN {isPrimary, label}]-> Chain
 * - Hadith -[:TAGGED]-> Tag
 * - Hadith -[:IDENTIFIED_AS {schemeKey, identifier, isPrimary, notes}]-> Identifier
 * - Hadith -[:GRADED {isPrimary, notes}]-> Grade
 * - Grade -[:BY]-> Scholar
 * - Chain -[:NARRATION_LEVEL]-> NarrationLevel
 * - Chain -[:CHAIN_TYPE]-> ChainType
 * - Chain -[:ATTRIBUTION_TYPE]-> AttributionType
 * - Chain -[:STEP {position, role, classificationId?, reliabilityId?, transmissionMethodId?, classification?, reliability?, transmissionMethod?}]-> Narrator
 * - Narrator -[:TIER]-> NarratorTier (optional if tier is narrator-level rather than step-level)
 * - Narrator -[:RELIABILITY]-> ReliabilityTier (optional if reliability is narrator-level rather than step-level)
 * - Narrator -[:HAS_METHOD]-> TransmissionMethod (use only if method is narrator-level; otherwise keep on STEP properties)
 *
 * Stable keys: every node stores its originating Postgres id as `pgId` and a synthetic `key`
 * (e.g., "Hadith:123") that can be used as the Neo4j primary key for MERGE operations.
 */

export type GraphLabel =
  | "Hadith"
  | "Matn"
  | "Source"
  | "Author"
  | "Book"
  | "Chapter"
  | "Chain"
  | "Narrator"
  | "Scholar"
  | "Grade"
  | "Tag"
  | "Identifier"
  | "NarrationLevel"
  | "ChainType"
  | "AttributionType"
  | "TransmissionMethod"
  | "ReliabilityTier"
  | "NarratorTier";

export type GraphRelationshipType =
  | "HAS_MATN"
  | "FROM_SOURCE"
  | "IN_BOOK"
  | "IN_CHAPTER"
  | "BY_AUTHOR"
  | "BELONGS_TO"
  | "HAS_CHAIN"
  | "TAGGED"
  | "IDENTIFIED_AS"
  | "GRADED"
  | "BY"
  | "NARRATION_LEVEL"
  | "CHAIN_TYPE"
  | "ATTRIBUTION_TYPE"
  | "STEP"
  | "TIER"
  | "RELIABILITY"
  | "HAS_METHOD";

export type GraphNode<L extends GraphLabel = GraphLabel, P extends object = Record<string, unknown>> = {
  label: L;
  key: string; // synthetic key for MERGE, e.g., `${label}:${pgId}`
  properties: P & { pgId: number };
};

export type GraphRelationship<
  T extends GraphRelationshipType = GraphRelationshipType,
  P extends object = Record<string, unknown>,
> = {
  type: T;
  from: string; // source node key
  to: string; // target node key
  properties?: P;
};

// Minimal graph DTOs for API responses
export type GraphApiNode = {
  id: string;
  label: string;
  type: string;
  provenance?: boolean;
};

export type GraphApiEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  provenance?: boolean;
  [key: string]: unknown;
};

// Domain-specific props
export type HadithNodeProps = {
  pgId: number;
  number: number;
  displayNumber?: string | null;
  displayLabel?: string | null;
  sourceName: string;
  bookName?: string | null;
  chapterName?: string | null;
  matnPreview?: string | null;
  location?: string | null;
  sanad?: string | null;
  embedding?: number[];
  embeddingModel?: string | null;
};

export type MatnNodeProps = {
  pgId: number;
  textEn: string;
  textAr?: string | null;
  summary?: string | null;
};

export type ChainNodeProps = {
  pgId: number;
  label?: string | null;
  isPrimary?: boolean | null;
  notes?: string | null;
  narrationLevel?: string | null;
  chainType?: string | null;
  attributionType?: string | null;
};

export type NarratorNodeProps = {
  pgId: number;
  name: string;
  descriptor?: string | null;
  lifespan?: string | null;
};

export type StepRelationshipProps = {
  position: number;
  role?: string | null;
  classificationId?: number | null;
  reliabilityId?: number | null;
  transmissionMethodId?: number | null;
  classification?: string | null;
  reliability?: string | null;
  transmissionMethod?: string | null;
};

export type GradeNodeProps = {
  pgId: number;
  name: string;
  description?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
};

export type ScholarNodeProps = {
  pgId: number;
  name: string;
  lifespan?: string | null;
};

export type AuthorNodeProps = {
  pgId: number;
  name: string;
  lifespan?: string | null;
};

export type IdentifierNodeProps = {
  pgId: number;
  schemeKey: string;
  identifier: string;
  notes?: string | null;
  isPrimary?: boolean | null;
};

export type TagNodeProps = { pgId: number; name: string };

export type LookupNodeProps = {
  pgId: number;
  title: string;
  secondary?: string | null;
  description?: string | null;
  badgeBackground?: string | null;
  badgeTextColor?: string | null;
  connectorColor?: string | null;
  pillBackgroundLight?: string | null;
  pillBackgroundDark?: string | null;
};
