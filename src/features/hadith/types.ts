export type MessageRole = "user" | "assistant";

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
};

export type NarrationLevel = "mutawatir" | "mashhur" | "aziz" | "gharib" | "fard";

export type ReliabilityTier =
  | "thiqah"
  | "saduq"
  | "layyin"
  | "matruk"
  | "kadhdhab"
  | "majhul_ayn"
  | "majhul_hal"
  | "mukhadram";

export type NarratorTier =
  | "sahabi"
  | "tabi"
  | "atbae"
  | "muhaddith"
  | "rawi"
  | "shaykh"
  | "talib"
  | "mujaz";

export type ChainNode = {
  name: string;
  descriptor?: string;
  lifespan?: string;
  type?: "prophet";
  classification?: NarratorTier;
  classificationDetail?: LookupDetail;
  reliability?: ReliabilityTier;
  reliabilityDetail?: ReliabilityDetail;
  transmissionMethodDetail?: TransmissionMethodDetail;
};

export type ScholarGrade = {
  name: string;
  lifespan?: string;
  gradeTitle?: string;
  isPrimary?: boolean;
};

export type GradeAttribution = {
  scholar: ScholarGrade;
  grade: GradeInfo;
  isPrimary?: boolean;
};

export type HadithIdentifier = {
  hadithId: number;
  schemeKey: string;
  identifier: string;
  notes?: string | null;
  isPrimary?: boolean | null;
};

export type HadithInsight = {
  id: string;
  matn: string;
  sanad: string;
  details: {
    source: string;
    book: string;
    bookNumber: number;
    chapter: string;
    grading: string;
    gradeInfo?: GradeInfo;
    hadithNumber: number;
    displayNumber?: string;
    displayLabel?: string;
    location: string;
    author?: {
      name: string;
      lifespan?: string;
    };
  };
  chain: ChainNode[];
  gradedBy?: ScholarGrade[];
  gradedGrades?: GradeAttribution[];
  identifiers?: HadithIdentifier[];
  sourceTypes: string[];
  sourceTypeDetails?: LookupDetail[];
  chainTypes: string[];
  chainTypeDetails?: LookupDetail[];
  narrationLevel: NarrationLevel;
  narrationLevelDetail?: LookupDetail;
};

export type GradingStyle = {
  background: string;
  color: string;
  description: string;
};

export type GradingPaletteEntry = {
  keywords: string[];
  style: GradingStyle;
};

export type SourceTypeInfo = {
  key: string;
  title: string;
  secondary?: string;
  description: string;
};

export type ChainTypeInfo = {
  key: string;
  title: string;
  secondary?: string;
  description: string;
};

export type NarrationLevelInfo = {
  title: string;
  secondary: string;
  description: string;
};

export type SourceAuthorInfo = {
  name: string;
  lifespan: string;
};

export type NarratorTierInfo = {
  title: string;
  secondary?: string;
  description: string;
};

export type ReliabilityTierInfo = {
  title: string;
  secondary?: string;
  description: string;
  badge: string;
  background: string;
  color: string;
};

export type TransmissionMethod = {
  title: string;
  description: string;
};

export type LookupDetail = {
  id: number;
  title: string;
  secondary?: string | null;
  description?: string | null;
};

export type GradeInfo = LookupDetail & {
  backgroundColor?: string | null;
  textColor?: string | null;
  description?: string | null;
};

export type ReliabilityDetail = LookupDetail & {
  badgeBackground?: string | null;
  badgeTextColor?: string | null;
  connectorColor?: string | null;
};

export type TransmissionMethodDetail = LookupDetail & {
  pillBackgroundLight?: string | null;
  pillBackgroundDark?: string | null;
};
