import {
  ChainTypeInfo,
  GradingPaletteEntry,
  GradingStyle,
  NarrationLevel,
  NarrationLevelInfo,
  NarratorTier,
  NarratorTierInfo,
  ReliabilityTier,
  ReliabilityTierInfo,
  SourceAuthorInfo,
  SourceTypeInfo,
  TransmissionMethod,
} from "./types";

export const gradingPalette: GradingPaletteEntry[] = [
  {
    keywords: ["muttafaq", "sahih li dhatih", "ṣaḥīḥ li dhātih"],
    style: {
      background: "#065f46",
      color: "#ecfdf5",
      description: "Fully authentic; narrators are strong and reliable.",
    },
  },
  {
    keywords: ["sahih li ghayrih", "ṣaḥīḥ li ghayrih"],
    style: {
      background: "#15803d",
      color: "#ecfdf5",
      description: "Became authentic due to supporting chains filling minor gaps.",
    },
  },
  {
    keywords: ["hasan li dhatih", "ḥasan li dhātih"],
    style: {
      background: "#65a30d",
      color: "#041b11",
      description: "Reliable overall but narrators have lighter memory weaknesses.",
    },
  },
  {
    keywords: ["hasan li ghayrih", "ḥasan li ghayrih"],
    style: {
      background: "#ca8a04",
      color: "#041b11",
      description: "Originally weak, strengthened by additional supporting chains.",
    },
  },
  {
    keywords: ["daif jiddan", "ḍaʿīf jiddan", "very weak"],
    style: {
      background: "#c2410c",
      color: "#fff7ed",
      description: "Very weak because one or more narrators are extremely unreliable.",
    },
  },
  {
    keywords: ["daif", "ḍaʿīf", "weak"],
    style: {
      background: "#ea580c",
      color: "#fff7ed",
      description: "Weak due to memory issues, a missing link, or a weak narrator.",
    },
  },
  {
    keywords: ["munkar"],
    style: {
      background: "#991b1b",
      color: "#fee2e2",
      description: "Rejected because a weak narrator contradicts stronger narrators.",
    },
  },
  {
    keywords: ["shadh", "shadhdh", "maqlub"],
    style: {
      background: "#7f1d1d",
      color: "#fee2e2",
      description: "Irregular because a reliable narrator contradicts stronger narrators.",
    },
  },
  {
    keywords: ["muallal", "muʿallal", "hidden defect"],
    style: {
      background: "#3f3d56",
      color: "#f4f4ff",
      description: "Has a subtle hidden flaw discovered by experts.",
    },
  },
  {
    keywords: ["mawdu", "mawḍūʿ", "fabricated"],
    style: {
      background: "#111827",
      color: "#f8fafc",
      description: "Fabricated and proven to be falsely attributed to the Prophet ﷺ.",
    },
  },
];

export const normalizeGrading = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’`´\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const getGradingStyle = (grading: string): GradingStyle => {
  const normalized = normalizeGrading(grading);
  for (const entry of gradingPalette) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.style;
    }
  }
  return { background: "#1f2937", color: "#f8fafc", description: "" };
};

export const formatGradingLabel = (grading: string) => {
  const normalized = normalizeGrading(grading);
  if (normalized.includes("mawdu")) {
    return `❌ ${grading}`;
  }
  return grading;
};

export const sourceTypeInfo: SourceTypeInfo[] = [
  {
    key: "marfu",
    title: "Marfūʿ",
    secondary: "(مرفوع)",
    description: "Attributed to the Prophet ﷺ.",
  },
  {
    key: "mawquf",
    title: "Mawqūf",
    secondary: "(موقوف)",
    description: "Statement/action of a Companion only.",
  },
  {
    key: "maqtu",
    title: "Maqṭūʿ",
    secondary: "(مقطوع)",
    description: "Statement of a Tābiʿī or later.",
  },
  {
    key: "athar",
    title: "Athar",
    secondary: "(أثر)",
    description: "General report — may be marfūʿ, mawqūf, or maqṭūʿ.",
  },
];

export const chainTypeInfo: ChainTypeInfo[] = [
  { key: "musnad", title: "Musnad", secondary: "(مسند)", description: "Fully connected chain reaching Prophet ﷺ." },
  { key: "mursal", title: "Mursal", secondary: "(مرسل)", description: "Tābiʿī skips the Companion." },
  { key: "munqati", title: "Munqaṭiʿ", secondary: "(منقطع)", description: "A break in the chain at any point." },
  { key: "muadal", title: "Muʿḍal", secondary: "(معضل)", description: "Two or more consecutive narrators missing." },
  { key: "muallaq", title: "Muʿallaq", secondary: "(معلق)", description: "Beginning of chain missing." },
  { key: "mudallas", title: "Mudallas", secondary: "(مدلس)", description: "Narrator hides the person he heard from." },
  { key: "muannan", title: "Muʿannʿan", secondary: "(معنعن)", description: "Narrated with “from” (عن); hearing not guaranteed." },
  { key: "mursal-jali", title: "Mursal Jali", secondary: "(مرسل جلي)", description: "Clear disconnection." },
  { key: "mursal-khafi", title: "Mursal Khafi", secondary: "(مرسل خفي)", description: "Hidden disconnection." },
];

export const narrationLevelInfo: Record<NarrationLevel, NarrationLevelInfo> = {
  mutawatir: {
    title: "Mutawātir",
    secondary: "(متواتر)",
    description: "Reported by many; impossible to fabricate.",
  },
  mashhur: {
    title: "Mashhūr",
    secondary: "(مشهور)",
    description: "Narrated by 3+ in every generation.",
  },
  aziz: {
    title: "ʿAzīz",
    secondary: "(عزيز)",
    description: "Narrated by at least 2 at each level.",
  },
  gharib: {
    title: "Gharīb",
    secondary: "(غريب)",
    description: "Single narrator at one stage.",
  },
  fard: {
    title: "Fard",
    secondary: "(فرد)",
    description: "Unique chain; only one path.",
  },
};

export const sourceAuthorMap: Record<string, SourceAuthorInfo> = {
  "Sahih al-Bukhari": { name: "Imam al-Bukhari", lifespan: "194–256 AH" },
  "Sahih Muslim": { name: "Imam Muslim", lifespan: "204–261 AH" },
  "Sunan al-Tirmidhi": { name: "Imam al-Tirmidhi", lifespan: "209–279 AH" },
  "Sunan Abi Dawud": { name: "Imam Abu Dawud", lifespan: "202–275 AH" },
  "Sunan al-Nasa'i": { name: "Imam al-Nasa'i", lifespan: "214–303 AH" },
  "Sunan Ibn Majah": { name: "Imam Ibn Majah", lifespan: "209–273 AH" },
  "Musnad Ahmad": { name: "Imam Ahmad ibn Hanbal", lifespan: "164–241 AH" },
  "Musannaf Ibn Abi Shaybah": { name: "Ibn Abi Shaybah", lifespan: "159–235 AH" },
  "Kitab al-Zuhd (Ibn al-Mubarak)": {
    name: "Abdullah ibn al-Mubarak",
    lifespan: "118–181 AH",
  },
  "Shu'ab al-Iman": { name: "Imam al-Bayhaqi", lifespan: "384–458 AH" },
  "Al-Bayhaqi, Shu'ab al-Iman": { name: "Imam al-Bayhaqi", lifespan: "384–458 AH" },
  "Sunan al-Kubra (al-Bayhaqi)": { name: "Imam al-Bayhaqi", lifespan: "384–458 AH" },
  "Sunan al-Daraqutni": { name: "Imam al-Daraqutni", lifespan: "306–385 AH" },
  "Al-Daraqutni, al-Ilal": { name: "Imam al-Daraqutni", lifespan: "306–385 AH" },
  "Al-Ilal Ibn Abi Hatim": { name: "Ibn Abi Hatim", lifespan: "240–327 AH" },
  "Al-Mu'jam al-Awsat": { name: "Imam al-Tabarani", lifespan: "260–360 AH" },
  "Al-Jami' al-Saghir": { name: "Imam al-Suyuti", lifespan: "849–911 AH" },
  "Sahih Ibn Hibban": { name: "Ibn Hibban", lifespan: "270–354 AH" },
  "Ibn Hibban, al-Majruhin": { name: "Ibn Hibban", lifespan: "270–354 AH" },
  "Ibn al-Jawzi, al-Mawdu'at": { name: "Ibn al-Jawzi", lifespan: "508–597 AH" },
  "Al-Suyuti, al-La'ali al-Masnu'a": { name: "Imam al-Suyuti", lifespan: "849–911 AH" },
  "Musnad al-Bazzar": { name: "Imam al-Bazzar", lifespan: "210–292 AH" },
};

export const narratorTierInfo: Record<NarratorTier, NarratorTierInfo> = {
  sahabi: {
    title: "Ṣaḥābī",
    description:
      "A Muslim who met the Prophet ﷺ, believed in him, and died as a believer.",
  },
  tabi: {
    title: "Tābiʿī",
    description: "A Muslim who met a Companion but did not meet the Prophet ﷺ.",
  },
  atbae: {
    title: "Atbāʿ al-Tābiʿīn",
    description: "Those who met the Tābiʿīn but did not meet Companions.",
  },
  muhaddith: {
    title: "Muhaddith",
    description: "A specialist who collects, transmits, and verifies hadith.",
  },
  rawi: {
    title: "Rāwī",
    description:
      "A transmitter anywhere in the isnād — from trustworthy to weak narrators.",
  },
  shaykh: {
    title: "Shaykh",
    description: "An immediate teacher from whom a narrator directly learned.",
  },
  talib: {
    title: "Ṭālib al-Ḥadīth",
    description: "Learners who travel to gather hadith and share what they learn.",
  },
  mujaz: {
    title: "Mujāz",
    description: "A narrator formally authorized to transmit specific chains.",
  },
};

export const reliabilityTierInfo: Record<
  ReliabilityTier,
  ReliabilityTierInfo
> = {
  thiqah: {
    title: "Thiqah",
    secondary: "(ثقة)",
    description: "Strong memory with impeccable character.",
    badge: "Thiqah",
    background: "#065f46",
    color: "#ecfdf5",
  },
  saduq: {
    title: "Ṣadūq",
    secondary: "(صدوق)",
    description: "Good character with slightly lighter memory.",
    badge: "Ṣadūq",
    background: "#15803d",
    color: "#ecfdf5",
  },
  layyin: {
    title: "Layyin",
    secondary: "(لين)",
    description: "Weak memory requiring support.",
    badge: "Layyin",
    background: "#f97316",
    color: "#fff7ed",
  },
  matruk: {
    title: "Matrūk",
    secondary: "(متروك)",
    description: "Extremely weak; narrations are left aside.",
    badge: "Matrūk",
    background: "#ea580c",
    color: "#fff7ed",
  },
  kadhdhab: {
    title: "Kādhdhāb",
    secondary: "(كذاب)",
    description: "Accused of fabricating hadith.",
    badge: "Kādhdhāb",
    background: "#7f1d1d",
    color: "#fee2e2",
  },
  majhul_ayn: {
    title: "Majhūl al-ʿAyn",
    secondary: "(مجهول العين)",
    description: "Only a single narrator reports from them.",
    badge: "Majhūl al-ʿAyn",
    background: "#475569",
    color: "#e2e8f0",
  },
  majhul_hal: {
    title: "Majhūl al-Ḥāl",
    secondary: "(مجهول الحال)",
    description: "Identity known but character not documented.",
    badge: "Majhūl al-Ḥāl",
    background: "#64748b",
    color: "#f8fafc",
  },
  mukhadram: {
    title: "Mukhadram",
    secondary: "(مخضرم)",
    description: "Lived during the Prophet’s era but never met him.",
    badge: "Mukhadram",
    background: "#2563eb",
    color: "#dbeafe",
  },
};

export const narratorLifespans: Record<string, string> = {
  "Sufyan al-Thawri": "97–161 AH",
  "Muhammad ibn Muslim al-Zuhri": "51–124 AH",
  "Sa'id ibn al-Musayyib": "15–94 AH",
  "Abu Huraira": "d. 58 AH",
  "Hammad ibn Salama": "d. 167 AH",
  "Abdullah ibn Mas'ud": "d. 32 AH",
  "Umar ibn al-Khattab": "40–23 AH",
  "Hisham al-Dustuwa'i": "105–153 AH",
  "Yunus ibn 'Ubayd": "d. 139 AH",
  "Al-Hasan al-Basri": "21–110 AH",
  "Sufyan ibn 'Uyaynah": "107–198 AH",
  "'Amr ibn Dinar": "46–126 AH",
  "Abdullah ibn Abbas": "3–68 AH",
  "Qatada ibn Di'ama": "d. 117 AH",
  "Anas ibn Malik": "1–93 AH",
  "Abd al-Malik ibn Jurayj": "80–150 AH",
  "Ata ibn Abi Rabah": "27–114 AH",
  "Abdullah ibn Umar": "10–73 AH",
  "Malik ibn Anas": "93–179 AH",
  "Abu al-Walid al-Tayalisi": "d. 227 AH",
  "Yahya ibn Abi Kathir": "d. 129 AH",
  "Abu Qilabah": "d. 104 AH",
  "Tamim al-Dari": "d. 40 AH",
  "Hajjaj ibn Hassan": "d. 212 AH",
  "Abdurrahman ibn Yazid ibn Jabir": "d. 153 AH",
  "Shaddad ibn Aws": "d. 81 AH",
  "Amr ibn Shu'ayb": "d. 118 AH",
  "Abdullah ibn Amr ibn al-As": "7 BH–65 AH",
  "Yazid ibn Harun": "118–206 AH",
  "Bilal ibn al-Harith": "d. 62 AH",
  "Mis'ar ibn Kidam": "d. 155 AH",
  "Mujahid ibn Jabr": "21–104 AH",
  "Abdullah ibn al-Mubarak": "118–181 AH",
  "Thabit al-Bunani": "d. 123 AH",
  "Nu'man ibn Bashir": "d. 65 AH",
  "Abu al-Zinad": "d. 130 AH",
  "Shahr ibn Hawshab": "d. 112 AH",
  "Khalid ibn Ilyas": "2nd c. AH",
  "Abu Ghassan Muhammad ibn Mutarrif": "d. 180 AH",
  "Abu Salih al-Samman": "d. 101 AH",
  "Abd al-Rahman ibn Ziyad al-Afriki": "d. 156 AH",
  "Aisha bint Abi Bakr": "614–678 CE",
  "Abdullah ibn Juraij": "80–150 AH",
  "Kuraib mawla Ibn Abbas": "d. 98 AH",
  "Ash'ath ibn Sawwar": "d. 179 AH",
  "Abdullah ibn Busr": "d. 96 AH",
  "Al-Samma' bint Busr": "1st c. AH",
  "Abd al-Aziz ibn al-Mutalib": "2nd c. AH",
  "Abu Ghutayf": "2nd c. AH",
  "Abd al-Zubayr al-Humaydi": "164–219 AH",
  "Abd al-Malik ibn Abd al-Aziz ibn Jurayj": "80–150 AH",
  "Abu Tamim al-Jayshani": "1st c. AH",
  "Alqamah ibn Qays": "d. 62 AH",
  "Muhammad ibn Ibrahim ibn Abi Sabrah": "2nd c. AH",
  "Ali ibn Abi Talib": "600–661 CE",
  "Ahmad ibn Abdullah al-Juwaybari": "d. 280 AH",
  "Ikrimah mawla Ibn Abbas": "d. 105 AH",
  "Abdullah ibn Lahi'ah": "97–174 AH",
};

export const transmissionMethods: TransmissionMethod[] = [
  {
    title: "Samāʿ",
    description: "Student hears directly from the teacher.",
  },
  {
    title: "Qirāʾah / ʿArḍ",
    description: "Student reads to the teacher who confirms.",
  },
  {
    title: "Ijāzah",
    description: "Teacher grants formal permission to transmit.",
  },
  {
    title: "Munāwalah",
    description: "Teacher hands written texts to the student.",
  },
  {
    title: "Mukātabah",
    description: "Teacher writes to the student conveying the hadith.",
  },
  {
    title: "Wajāda",
    description: "Narrator discovers a work attributable to a teacher.",
  },
  {
    title: "Ḥaml",
    description: "Student carries manuscripts received from the teacher.",
  },
];
