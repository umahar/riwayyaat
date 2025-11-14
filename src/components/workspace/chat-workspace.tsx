"use client";

import {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

type NarrationLevel =
  | "mutawatir"
  | "mashhur"
  | "aziz"
  | "gharib"
  | "fard";

type ReliabilityTier =
  | "thiqah"
  | "saduq"
  | "layyin"
  | "matruk"
  | "kadhdhab"
  | "majhul_ayn"
  | "majhul_hal"
  | "mukhadram";

type SourceAuthorInfo = {
  name: string;
  lifespan: string;
};

type NarratorTier =
  | "sahabi"
  | "tabi"
  | "atbae"
  | "muhaddith"
  | "rawi"
  | "shaykh"
  | "talib"
  | "mujaz";

type HadithInsight = {
  id: string;
  matn: string;
  sanad: string;
  details: {
    source: string;
    book: string;
    bookNumber: number;
    chapter: string;
    grading: string;
    hadithNumber: number;
    location: string;
  };
  chain: Array<{
    name: string;
    descriptor?: string;
    type?: "prophet";
    classification?: NarratorTier;
    reliability?: ReliabilityTier;
  }>;
  sourceTypes: string[];
  chainTypes: string[];
  narrationLevel: NarrationLevel;
};

type GradingStyle = {
  background: string;
  color: string;
  description: string;
};

type GradingPaletteEntry = {
  keywords: string[];
  style: GradingStyle;
};

const gradingPalette: GradingPaletteEntry[] = [
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

const normalizeGrading = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/['’`´\-]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getGradingStyle = (grading: string): GradingStyle => {
  const normalized = normalizeGrading(grading);
  for (const entry of gradingPalette) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.style;
    }
  }
  return { background: "#1f2937", color: "#f8fafc", description: "" };
};

const formatGradingLabel = (grading: string) => {
  const normalized = normalizeGrading(grading);
  if (normalized.includes("mawdu")) {
    return `❌ ${grading}`;
  }
  return grading;
};

const sourceTypeInfo: Array<{
  key: string;
  title: string;
  secondary?: string;
  description: string;
}> = [
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

const chainTypeInfo: Array<{
  key: string;
  title: string;
  secondary?: string;
  description: string;
}> = [
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

const narrationLevelInfo: Record<
  NarrationLevel,
  { title: string; secondary: string; description: string }
> = {
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

const sourceAuthorMap: Record<string, SourceAuthorInfo> = {
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

const narratorTierInfo: Record<
  NarratorTier,
  { title: string; secondary?: string; description: string }
> = {
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

const reliabilityTierInfo: Record<
  ReliabilityTier,
  {
    title: string;
    secondary?: string;
    description: string;
    badge: string;
    background: string;
    color: string;
  }
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

const narratorLifespans: Record<string, string> = {
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
  "Anas ibn Malik": "1–93 AH",
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

const transmissionMethods = [
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
const hadithInsights: HadithInsight[] = [
  {
    id: "niyyah-musnad",
    matn:
      "Actions are judged by intentions, and every person will receive only what they intended. Whoever migrates for Allah and His Messenger, then his migration is truly for Allah and His Messenger; whoever migrates for worldly gain or to marry will have only what he pursued.",
    sanad:
      "Narrated by Umar ibn al-Khattab, transmitted by Alqamah ibn Waqqas, narrated by Muhammad ibn Ibrahim al-Taymi, reported by Yahya ibn Bukayr, preserved by Imam al-Bukhari.",
    details: {
      source: "Sahih al-Bukhari",
      book: "Book of Revelation",
      bookNumber: 1,
      chapter: "How revelation began",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 1,
      location: "Hadith 1",
    },
    chain: [
      { name: "Yahya ibn Bukayr", descriptor: "Primary transmitter", classification: "muhaddith", reliability: "thiqah" },
      { name: "Layth ibn Sa'd", descriptor: "Egyptian jurist", classification: "muhaddith", reliability: "thiqah" },
      { name: "Muhammad ibn Ibrahim al-Taymi", descriptor: "Medinese scholar", classification: "tabi", reliability: "thiqah" },
      { name: "Alqamah ibn Waqqas", descriptor: "Companion student", classification: "sahabi", reliability: "thiqah" },
      { name: "Umar ibn al-Khattab", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "gharib",
  },
  {
    id: "tirmidhi-knowledge",
    matn:
      "Whoever is asked about knowledge and conceals it will be bridled with a bridle of fire on the Day of Resurrection.",
    sanad:
      "Narrated by Abu Huraira, transmitted by Al-Zuhri, narrated by Sufyan al-Thawri with tadlis from him, collected by al-Tirmidhi (39:2649).",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Knowledge",
      bookNumber: 39,
      chapter: "Concealing knowledge",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 2649,
      location: "Hadith 2649",
    },
    chain: [
      { name: "Sufyan al-Thawri", descriptor: "Kufan hadith master (mudallis)", classification: "muhaddith", reliability: "thiqah" },
      { name: "Muhammad ibn Muslim al-Zuhri", descriptor: "Scholar of Medina", classification: "tabi", reliability: "thiqah" },
      { name: "Sa'id ibn al-Musayyib", descriptor: "Leader of the Tābi'īn", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "mudallas"],
    narrationLevel: "aziz",
  },
  {
    id: "umar-mawquf",
    matn:
      "Learn knowledge before leadership comes to you, for when authority arrives, there is no return to study.",
    sanad:
      "Narrated by Umar ibn al-Khattab, transmitted by Abdullah ibn Mas'ud, narrated by Hammad ibn Salama, recorded by Ibn Abi Shaybah (Musannaf 25009).",
    details: {
      source: "Musannaf Ibn Abi Shaybah",
      book: "Knowledge",
      bookNumber: 38,
      chapter: "Learning before authority",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 25009,
      location: "Report 25009",
    },
    chain: [
      { name: "Hammad ibn Salama", descriptor: "Basran transmitter", classification: "muhaddith", reliability: "thiqah" },
      { name: "Abu Ishaq al-Sabi'i", descriptor: "Kufan teacher", classification: "tabi", reliability: "saduq" },
      { name: "Abdullah ibn Mas'ud", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Umar ibn al-Khattab", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
    ],
    sourceTypes: ["mawquf"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "hasan-maqtu",
    matn:
      "The believer does not reach the reality of faith until the worldly life becomes as insignificant to him as a handful of dust.",
    sanad:
      "Statement of al-Hasan al-Basri through Yunus ibn 'Ubayd and Hisham al-Dustuwa'i, collected by Ibn al-Mubarak in al-Zuhd.",
    details: {
      source: "Kitab al-Zuhd (Ibn al-Mubarak)",
      book: "Sayings of the Tābi'īn",
      bookNumber: 7,
      chapter: "Detachment",
      grading: "Ḥasan li-dhātih",
      hadithNumber: 1345,
      location: "Report 1345",
    },
    chain: [
      { name: "Hisham al-Dustuwa'i", descriptor: "Basran transmitter", classification: "atbae", reliability: "thiqah" },
      { name: "Yunus ibn 'Ubayd", descriptor: "Ascetic", classification: "tabi", reliability: "thiqah" },
      { name: "Al-Hasan al-Basri", descriptor: "Tābi'ī sage", classification: "tabi", reliability: "thiqah" },
    ],
    sourceTypes: ["maqtu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "athar-ibnabbas",
    matn:
      "Abdullah ibn Abbas described that the people used to gather around the Prophet ﷺ in Mina, and when everyone had dispersed he would remain standing to remember Allah until the sun declined.",
    sanad:
      "Reported from Ibn Abbas via 'Amr ibn Dinar and Sufyan ibn 'Uyaynah; recorded by al-Bayhaqi in Shu'ab al-Iman.",
    details: {
      source: "Shu'ab al-Iman",
      book: "Remembrance",
      bookNumber: 2,
      chapter: "Dhikr in Mina",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 3435,
      location: "Report 3435",
    },
    chain: [
      { name: "Sufyan ibn 'Uyaynah", descriptor: "Meccan hadith master", classification: "muhaddith", reliability: "thiqah" },
      { name: "'Amr ibn Dinar", descriptor: "Meccan jurist", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Abbas", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
    ],
    sourceTypes: ["athar"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "mursal-hasan",
    matn:
      "Al-Hasan al-Basri said: The Messenger of Allah ﷺ said, 'Whoever shortens his sermon and lengthens his prayer has truly understood.'",
    sanad:
      "Al-Hasan al-Basri narrates directly from the Prophet without mentioning a Companion; cited by Abu Dawud (Hadith 1107).",
    details: {
      source: "Sunan Abi Dawud",
      book: "Prayer",
      bookNumber: 2,
      chapter: "Brevity of the khutbah",
      grading: "Ḍaʿīf",
      hadithNumber: 1107,
      location: "Hadith 1107",
    },
    chain: [
      { name: "Al-Hasan al-Basri", descriptor: "Tābi'ī sage", classification: "tabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["mursal"],
    narrationLevel: "fard",
  },
  {
    id: "munqati-sighting",
    matn:
      "Seek the night of decree in the last ten nights of Ramadan, for the angels descend with mercy upon those standing in prayer.",
    sanad:
      "Narrated by Ubayy ibn Ka'b, transmitted by Abu Ishaq, but the link between Abu Ishaq and Ubayy is missing in a version recorded by al-Daraqutni, rendering it munqaṭiʿ.",
    details: {
      source: "Sunan al-Daraqutni",
      book: "Fasting",
      bookNumber: 14,
      chapter: "Virtues of Laylat al-Qadr",
      grading: "Ḍaʿīf",
      hadithNumber: 2180,
      location: "Report 2180",
    },
    chain: [
      { name: "Abu Ishaq al-Sabi'i", descriptor: "Kufan teacher", classification: "tabi", reliability: "saduq" },
      { name: "Ubayy ibn Ka'b", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["munqati"],
    narrationLevel: "gharib",
  },
  {
    id: "muadal-qatada",
    matn:
      "Whoever Allah guides to knowledge and gratitude has been given the completeness of blessing.",
    sanad:
      "Attributed to the Prophet ﷺ with a chain in which Qatada reports from Anas while omitting two narrators, recorded by al-Tabarani in al-Awsat; the break makes it muʿḍal.",
    details: {
      source: "Al-Mu'jam al-Awsat",
      book: "Virtues",
      bookNumber: 8,
      chapter: "Gratitude",
      grading: "Ḍaʿīf",
      hadithNumber: 5127,
      location: "Hadith 5127",
    },
    chain: [
      { name: "Qatada ibn Di'ama", descriptor: "Basran exegete", classification: "tabi", reliability: "thiqah" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["muadal"],
    narrationLevel: "fard",
  },
  {
    id: "muallaq-bukhari",
    matn:
      "The Prophet ﷺ said: 'Deeds are presented on Mondays and Thursdays.'",
    sanad:
      "Imam al-Bukhari narrates it muʿallaq in his Sahih (Book 30, Chapter 7) from Abu Huraira without mentioning the complete chain.",
    details: {
      source: "Sahih al-Bukhari",
      book: "Fasting",
      bookNumber: 30,
      chapter: "Deeds presented",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 1899,
      location: "Hadith 1899",
    },
    chain: [
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["muallaq"],
    narrationLevel: "gharib",
  },
  {
    id: "mudallas-sighting",
    matn:
      "Verily Allah looks at the hearts of the servants in Ramadan, and whoever nurtures rancor is deprived of forgiveness.",
    sanad:
      "Narrated through Abu Qilabah from Abu Huraira but Sufyan ibn Husayn practiced tadlis by omitting his shaykh; cited by Ibn Hibban.",
    details: {
      source: "Sahih Ibn Hibban",
      book: "Fasting",
      bookNumber: 8,
      chapter: "Virtues of Ramadan",
      grading: "Ḍaʿīf",
      hadithNumber: 3437,
      location: "Hadith 3437",
    },
    chain: [
      { name: "Sufyan ibn Husayn", descriptor: "Narrator known for tadlis", classification: "rawi", reliability: "layyin" },
      { name: "Abu Qilabah", descriptor: "Follower", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["mudallas"],
    narrationLevel: "aziz",
  },
  {
    id: "mursal-jali",
    matn:
      "Abu Qilabah said that the Messenger of Allah ﷺ forbade the tax on a dog, yet he narrates it without naming the Companion, making the disconnection explicit.",
    sanad:
      "Recorded by al-Nasa'i with Abu Qilabah reporting directly; scholars classify it as mursal jali.",
    details: {
      source: "Sunan al-Nasa'i",
      book: "Commerce",
      bookNumber: 30,
      chapter: "Levying fees",
      grading: "Ḍaʿīf",
      hadithNumber: 4679,
      location: "Hadith 4679",
    },
    chain: [
      { name: "Abu Qilabah", descriptor: "Follower", classification: "tabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["mursal-jali"],
    narrationLevel: "fard",
  },
  {
    id: "mursal-khafi",
    matn:
      "Ibn Jurayj reports that Ata said the Prophet ﷺ forbade selling fruit before it ripens, though Ibn Jurayj did not meet Ata in this narration, rendering it a hidden disconnection.",
    sanad:
      "Cited by al-Bayhaqi; Ibn Jurayj narrates 'an Ata using ambiguous wording, so scholars classify it as mursal khafi.",
    details: {
      source: "Sunan al-Kubra (al-Bayhaqi)",
      book: "Transactions",
      bookNumber: 5,
      chapter: "Sale of fruits",
      grading: "Ḍaʿīf",
      hadithNumber: 10841,
      location: "Hadith 10841",
    },
    chain: [
      { name: "Abd al-Malik ibn Jurayj", descriptor: "Meccan narrator", classification: "atbae", reliability: "saduq" },
      { name: "Ata ibn Abi Rabah", descriptor: "Senior Tābi'ī", classification: "tabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["mursal-khafi", "muannan"],
    narrationLevel: "gharib",
  },
  {
    id: "pillars-sahih",
    matn:
      "Islam is built on five pillars: the testimony, prayer, charity, pilgrimage, and fasting Ramadan.",
    sanad:
      "Narrated by Abdullah ibn Umar through his freedman Nafi', preserved by Malik ibn Anas and transmitted by Abdullah ibn Yusuf to Imam al-Bukhari (Kitab al-Iman, Hadith 8).",
    details: {
      source: "Sahih al-Bukhari",
      book: "Faith",
      bookNumber: 2,
      chapter: "Foundations of Islam",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 8,
      location: "Hadith 8",
    },
    chain: [
      { name: "Abdullah ibn Yusuf al-Tinnisi", descriptor: "Damascene transmitter", classification: "muhaddith", reliability: "thiqah" },
      { name: "Malik ibn Anas", descriptor: "Imam of Medina", classification: "muhaddith", reliability: "thiqah" },
      { name: "Nafi' mawla Ibn Umar", descriptor: "Freedman of Ibn Umar", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "mutawatir",
  },
  {
    id: "love-for-brother",
    matn:
      "None of you truly believes until he loves for his brother what he loves for himself.",
    sanad:
      "Transmitted from Anas ibn Malik via Qatada ibn Di'ama and the Basran master Hammad ibn Zayd, narrated by Abu al-Walid al-Tayalisi; collected by Imam Muslim (Kitab al-Iman, Hadith 45).",
    details: {
      source: "Sahih Muslim",
      book: "Faith",
      bookNumber: 1,
      chapter: "Love for believers",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 45,
      location: "Hadith 45",
    },
    chain: [
      { name: "Abu al-Walid al-Tayalisi", descriptor: "Basran musnid", classification: "muhaddith", reliability: "thiqah" },
      { name: "Hammad ibn Zayd", descriptor: "Basran hadith master", classification: "muhaddith", reliability: "thiqah" },
      { name: "Qatada ibn Di'ama", descriptor: "Exegete of Basra", classification: "tabi", reliability: "thiqah" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "mashhur",
  },
  {
    id: "religion-sincere-counsel",
    matn:
      "The religion is sincere counsel: for Allah, His Book, His Messenger, the leaders of the Muslims, and their common folk.",
    sanad:
      "Reported by Tamim al-Dari through Abu Asma' al-Rahbi and Abu Qilabah, narrated by Yahya ibn Abi Kathir and collected by Imam Muslim (Kitab al-Iman, Hadith 95).",
    details: {
      source: "Sahih Muslim",
      book: "Faith",
      bookNumber: 1,
      chapter: "Sincere counsel",
      grading: "Ṣaḥīḥ li-dhātih",
      hadithNumber: 95,
      location: "Hadith 95",
    },
    chain: [
      { name: "Yahya ibn Abi Kathir", descriptor: "Scholar of Basra", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Qilabah", descriptor: "Follower", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Asma' al-Rahbi", descriptor: "Syrian jurist", classification: "tabi", reliability: "thiqah" },
      { name: "Tamim al-Dari", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "gharib",
  },
  {
    id: "ihsan-sahih-lighayrih",
    matn:
      "Allah has prescribed excellence in all things; when you slaughter then slaughter well and sharpen the blade.",
    sanad:
      "Narrated by Shaddad ibn Aws through Abdurrahman ibn Yazid, transmitted by Hajjaj ibn Hassan and corroborated by multiple chains collected by Abu Dawud and al-Tirmidhi, who graded it sahih li-ghayrih.",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Sacrifices",
      bookNumber: 18,
      chapter: "Etiquette of slaughter",
      grading: "Ṣaḥīḥ li-ghayrih",
      hadithNumber: 1409,
      location: "Hadith 1409",
    },
    chain: [
      { name: "Hajjaj ibn Hassan", descriptor: "Basran transmitter", classification: "rawi", reliability: "saduq" },
      { name: "Abdurrahman ibn Yazid ibn Jabir", descriptor: "Damascene reliable", classification: "tabi", reliability: "thiqah" },
      { name: "Shaddad ibn Aws", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "mercy-sahih-lighayrih",
    matn:
      "The merciful are shown mercy by the Most Merciful; show mercy to those on earth and the One above the heavens will show mercy to you.",
    sanad:
      "Reported from Abdullah ibn Amr ibn al-As via his grandson Amr ibn Shu'ayb, narrated by Sufyan ibn 'Uyaynah, supported by parallel chains gathered by al-Tirmidhi and Ahmad until the report reached the level of sahih li-ghayrih.",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Birr and Mercy",
      bookNumber: 27,
      chapter: "Compassion",
      grading: "Ṣaḥīḥ li-ghayrih",
      hadithNumber: 1924,
      location: "Hadith 1924",
    },
    chain: [
      { name: "Sufyan ibn 'Uyaynah", descriptor: "Meccan hadith master", classification: "muhaddith", reliability: "thiqah" },
      { name: "Amr ibn Shu'ayb", descriptor: "Descendant of Abdullah ibn Amr", classification: "tabi", reliability: "saduq" },
      { name: "Abdullah ibn Amr ibn al-As", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "mashhur",
  },
  {
    id: "revive-sunnah-sahih-lighayrih",
    matn:
      "Whoever revives a forgotten sunnah of mine will have the reward of those who practice it without their reward being diminished.",
    sanad:
      "Narrated by Bilal ibn al-Harith al-Muzani, transmitted by al-Qasim ibn Abdurrahman and multiple Basran narrators; collected by Ibn Majah and Ahmad with supporting chains that elevate it to sahih li-ghayrih.",
    details: {
      source: "Musnad Ahmad",
      book: "Companions of the Prophet",
      bookNumber: 35,
      chapter: "Hadith of Bilal ibn al-Harith",
      grading: "Ṣaḥīḥ li-ghayrih",
      hadithNumber: 23824,
      location: "Hadith 23824",
    },
    chain: [
      { name: "Yazid ibn Harun", descriptor: "Basran memorizer", classification: "muhaddith", reliability: "thiqah" },
      { name: "Al-Qasim ibn Abdurrahman", descriptor: "Grandson of Abdullah ibn Mas'ud", classification: "tabi", reliability: "thiqah" },
      { name: "Bilal ibn al-Harith", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "concern-hasan-lidhatih",
    matn:
      "Part of the perfection of someone's Islam is leaving what does not concern him.",
    sanad:
      "Reported from Abu Huraira via Yahya ibn Sa'id al-Ansari and Ibn Shihab al-Zuhri, transmitted by Malik ibn Anas; graded hasan li-dhātih by al-Tirmidhi (Zuhd, Hadith 2317).",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Asceticism",
      bookNumber: 36,
      chapter: "Guarding the tongue",
      grading: "Ḥasan li-dhātih",
      hadithNumber: 2317,
      location: "Hadith 2317",
    },
    chain: [
      { name: "Malik ibn Anas", descriptor: "Imam of Medina", classification: "muhaddith", reliability: "thiqah" },
      { name: "Ibn Shihab al-Zuhri", descriptor: "Medinese scholar", classification: "tabi", reliability: "thiqah" },
      { name: "Yahya ibn Sa'id al-Ansari", descriptor: "Early judge of Medina", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "mashhur",
  },
  {
    id: "no-harm-hasan",
    matn:
      "There should be neither harming nor reciprocating harm.",
    sanad:
      "Narrated by Ubadah ibn al-Samit via Abu Idris al-Khawlani and transmitted by Al-Layth ibn Sa'd; collected by Ibn Majah (Ahkam, Hadith 2340) and graded hasan li-dhātih by al-Nawawi.",
    details: {
      source: "Sunan Ibn Majah",
      book: "Legal rulings",
      bookNumber: 13,
      chapter: "Preventing harm",
      grading: "Ḥasan li-dhātih",
      hadithNumber: 2340,
      location: "Hadith 2340",
    },
    chain: [
      { name: "Al-Layth ibn Sa'd", descriptor: "Egyptian jurist", classification: "muhaddith", reliability: "thiqah" },
      { name: "Yahya ibn Sa'id al-Ansari", descriptor: "Medinese judge", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Idris al-Khawlani", descriptor: "Damascene tabi'i", classification: "tabi", reliability: "thiqah" },
      { name: "Ubadah ibn al-Samit", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "mashhur",
  },
  {
    id: "believer-mixes-hasan",
    matn:
      "The believer who mixes with people and bears their harm has greater reward than the one who does not mix and does not endure them.",
    sanad:
      "Reported from Ibn Umar via Mujahid ibn Jabr and Mis'ar ibn Kidam; collected by Ibn Majah (Fitan, Hadith 4032) with a chain judged hasan li-dhātih by Ibn Hajar.",
    details: {
      source: "Sunan Ibn Majah",
      book: "Trials",
      bookNumber: 36,
      chapter: "Enduring people's harm",
      grading: "Ḥasan li-dhātih",
      hadithNumber: 4032,
      location: "Hadith 4032",
    },
    chain: [
      { name: "Mis'ar ibn Kidam", descriptor: "Kufan narrator", classification: "atbae", reliability: "thiqah" },
      { name: "Mujahid ibn Jabr", descriptor: "Meccan exegete", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "tie-camel-hasan-lighayrih",
    matn:
      "A man said, 'Should I tie my camel and trust Allah?' The Prophet ﷺ replied, 'Tie it first and then trust.'",
    sanad:
      "Narrated by Anas ibn Malik via Hisham ibn Hassan and Thabit al-Bunani; collected by al-Tirmidhi (Sifat al-Qiyamah, Hadith 2517) with supporting routes that raise it to hasan li-ghayrih.",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Descriptions of the Resurrection",
      bookNumber: 44,
      chapter: "Reliance",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 2517,
      location: "Hadith 2517",
    },
    chain: [
      { name: "Abdullah ibn al-Mubarak", descriptor: "Khurasani imam", classification: "muhaddith", reliability: "thiqah" },
      { name: "Hisham ibn Hassan", descriptor: "Basran narrator", classification: "atbae", reliability: "saduq" },
      { name: "Thabit al-Bunani", descriptor: "Student of Anas", classification: "tabi", reliability: "thiqah" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "mashhur",
  },
  {
    id: "supplication-worship-hasan-lighayrih",
    matn:
      "Supplication is worship, then the Prophet ﷺ recited: 'Your Lord said: Call upon Me, I will respond.'",
    sanad:
      "Reported from Nu'man ibn Bashir via Abu Is'haq al-Sabi'i with corroborating routes through Tariq ibn Ashyam; collected by al-Tirmidhi (Da'awat, Hadith 3372) and graded hasan li-ghayrih.",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Supplications",
      bookNumber: 48,
      chapter: "Virtue of du'a",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 3372,
      location: "Hadith 3372",
    },
    chain: [
      { name: "Abu Ishaq al-Sabi'i", descriptor: "Kufan transmitter", classification: "tabi", reliability: "saduq" },
      { name: "Nu'man ibn Bashir", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "aziz",
  },
  {
    id: "relieve-distress-hasan-lighayrih",
    matn:
      "Whoever relieves a believer of worldly distress, Allah will relieve him of distress on the Day of Resurrection.",
    sanad:
      "Narrated by Abu Huraira through Al-A'raj and Abu al-Zinad; collected by Muslim and others. In Sunan al-Tirmidhi (Birr, Hadith 1930) it is supported by additional chains, so later scholars labeled that recension hasan li-ghayrih.",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Birr and Mercy",
      bookNumber: 27,
      chapter: "Cooperation",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 1930,
      location: "Hadith 1930",
    },
    chain: [
      { name: "Abu al-Zinad", descriptor: "Medinese faqih", classification: "atbae", reliability: "saduq" },
      { name: "Al-A'raj (Abu Dawud Nufayr)", descriptor: "Freedman of Abu Huraira", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "mutawatir",
  },
  {
    id: "china-knowledge-daif",
    matn:
      "Seek knowledge even if it is in China.",
    sanad:
      "Attributed to Anas ibn Malik through the narrator Abu Atiyyah al-Wazzan; the chain contains a weak narrator (Shahr ibn Hawshab) and disconnection, so scholars such as al-Bayhaqi and Ibn Hibban labeled it ḍaʿīf.",
    details: {
      source: "Al-Bayhaqi, Shu'ab al-Iman",
      book: "Knowledge",
      bookNumber: 2,
      chapter: "Obligation to learn",
      grading: "Ḍaʿīf",
      hadithNumber: 1763,
      location: "Report 1763",
    },
    chain: [
      { name: "Shahr ibn Hawshab", descriptor: "Narrator with memory issues", classification: "tabi", reliability: "layyin" },
      { name: "Abu Atiyyah al-Wazzan", descriptor: "Basran narrator", classification: "rawi", reliability: "majhul_hal" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "difference-mercy-daif",
    matn:
      "The difference of my ummah is a mercy.",
    sanad:
      "Reported from Ibn Umar with the narrator Ismail ibn Yahya al-Muzani and other weak links; al-Suyuti cited it in al-Jami' but declared the isnad ḍaʿīf due to fabricators in the chain.",
    details: {
      source: "Al-Jami' al-Saghir",
      book: "Virtues",
      bookNumber: 24,
      chapter: "Unity",
      grading: "Ḍaʿīf",
      hadithNumber: 8798,
      location: "Entry 8798",
    },
    chain: [
      { name: "Ismail ibn Yahya al-Muzani", descriptor: "Weak narrator", classification: "rawi", reliability: "majhul_hal" },
      { name: "Nafi' mawla Ibn Umar", descriptor: "Freedman of Ibn Umar", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "twelve-rakah-jumua-daif",
    matn:
      "Whoever prays twelve rak'ahs before Friday, Allah builds for him a palace in Paradise.",
    sanad:
      "Attributed to Ibn Umar through Ibn Lahi'ah and an unknown narrator; cited by Ibn Majah (Hadith 1382) and declared ḍaʿīf because of Ibn Lahi'ah's poor memory and an unrecognized transmitter.",
    details: {
      source: "Sunan Ibn Majah",
      book: "Prayer",
      bookNumber: 5,
      chapter: "Voluntary prayer on Friday",
      grading: "Ḍaʿīf",
      hadithNumber: 1382,
      location: "Hadith 1382",
    },
    chain: [
      { name: "Abdullah ibn Lahi'ah", descriptor: "Egyptian judge with weak memory", classification: "rawi", reliability: "layyin" },
      { name: "Abu al-Khattab", descriptor: "Unknown narrator", classification: "rawi", reliability: "majhul_ayn" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "yasin-grave-daif-jiddan",
    matn:
      "Whoever recites Surah Yasin at a grave, their punishment is lightened for them on that day.",
    sanad:
      "Attributed to Abu Huraira through Sulayman ibn Arin and another unknown narrator; Ibn Hibban labeled it ḍaʿīf jiddan because Sulayman was accused of fabrication.",
    details: {
      source: "Ibn Hibban, al-Majruhin",
      book: "Virtues",
      bookNumber: 2,
      chapter: "Recitation at graves",
      grading: "Ḍaʿīf Jiddan",
      hadithNumber: 910,
      location: "Entry 910",
    },
    chain: [
      { name: "Sulayman ibn Arin", descriptor: "Accused of fabrication", classification: "rawi", reliability: "kadhdhab" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "rajab-fast-daif-jiddan",
    matn:
      "Whoever fasts the first Friday of Rajab and prays on its night will have the reward of one hundred years of worship.",
    sanad:
      "Narrated through the chain of Abu Bakr ibn Abi Maryam who was severely weak after losing his books; cited by Ibn al-Jawzi in al-Mawdu'at and graded ḍaʿīf jiddan.",
    details: {
      source: "Ibn al-Jawzi, al-Mawdu'at",
      book: "Fasting",
      bookNumber: 2,
      chapter: "Virtues of Rajab",
      grading: "Ḍaʿīf Jiddan",
      hadithNumber: 337,
      location: "Entry 337",
    },
    chain: [
      { name: "Abu Bakr ibn Abi Maryam", descriptor: "Syrian narrator who became confused", classification: "rawi", reliability: "layyin" },
      { name: "Muhammad ibn al-Munkadir", descriptor: "Medinese scholar", classification: "tabi", reliability: "thiqah" },
      { name: "Jabir ibn Abdullah", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "sadaqah-protects-daif-jiddan",
    matn:
      "Give charity on the first of every month and no calamity will touch you for thirty days.",
    sanad:
      "Reported from Anas ibn Malik through the narrator Khalid ibn Ilyas who was declared a liar by Yahya ibn Ma'in; al-Tabarani mentioned it in al-Awsat with the verdict ḍaʿīf jiddan.",
    details: {
      source: "Al-Mu'jam al-Awsat",
      book: "Charity",
      bookNumber: 5,
      chapter: "Monthly sadaqah",
      grading: "Ḍaʿīf Jiddan",
      hadithNumber: 5129,
      location: "Hadith 5129",
    },
    chain: [
      { name: "Khalid ibn Ilyas", descriptor: "Rejected narrator", classification: "rawi", reliability: "matruk" },
      { name: "Abu Bakr ibn Abi Maryam", descriptor: "Syrian narrator", classification: "rawi", reliability: "layyin" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "six-rakats-munkar",
    matn:
      "Whoever prays six rak'ahs after Maghrib, a barrier is placed between him and the Fire.",
    sanad:
      "Attributed to Abu Huraira via the narrator Abu Ghassān Muhammad ibn Mutarrif; Ibn Adi and al-Nasa'i labeled it munkar because Abu Ghassān contradicted reliable narrators.",
    details: {
      source: "Musnad al-Bazzar",
      book: "Prayer",
      bookNumber: 4,
      chapter: "Virtues of voluntary prayers",
      grading: "Munkar",
      hadithNumber: 2879,
      location: "Hadith 2879",
    },
    chain: [
      { name: "Abu Ghassan Muhammad ibn Mutarrif", descriptor: "Narrator with munkar reports", classification: "rawi", reliability: "layyin" },
      { name: "Abu Salih al-Samman", descriptor: "Medinese narrator", classification: "tabi", reliability: "thiqah" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "visit-parents-grave-munkar",
    matn:
      "Whoever visits the graves of his parents every Friday will be forgiven and recorded as dutiful.",
    sanad:
      "Narrated from Aisha through the narrator Abd al-Rahman ibn Ziyad al-Afriki; Abu Hatim labeled him munkar al-hadith so the report is rejected.",
    details: {
      source: "Sunan al-Daraqutni",
      book: "Funerals",
      bookNumber: 7,
      chapter: "Visiting graves",
      grading: "Munkar",
      hadithNumber: 210,
      location: "Report 210",
    },
    chain: [
      { name: "Abd al-Rahman ibn Ziyad al-Afriki", descriptor: "North African narrator declared munkar", classification: "tabi", reliability: "layyin" },
      { name: "Abu Ghalib", descriptor: "Damascene narrator", classification: "rawi", reliability: "saduq" },
      { name: "Aisha bint Abi Bakr", descriptor: "Mother of the believers", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "rajab-umrah-munkar",
    matn:
      "Performing one umrah in Rajab equals seven pilgrimages.",
    sanad:
      "Reported from Ibn Umar via the narrator Ibn Lahi'ah with an additional weak transmitter, contradicting authentic narrations; al-Bayhaqi graded it munkar.",
    details: {
      source: "Shu'ab al-Iman",
      book: "Pilgrimage",
      bookNumber: 5,
      chapter: "Virtues of Rajab",
      grading: "Munkar",
      hadithNumber: 3901,
      location: "Report 3901",
    },
    chain: [
      { name: "Abdullah ibn Lahi'ah", descriptor: "Weak Egyptian judge", classification: "rawi", reliability: "layyin" },
      { name: "Abu Farwah Yazid ibn Sinan", descriptor: "Narrator of munkar reports", classification: "rawi", reliability: "matruk" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "maymuna-marriage-shadh",
    matn:
      "Ibn Abbas reported that the Prophet ﷺ married Maymuna while he was in ihram.",
    sanad:
      "Narrated by Abdullah ibn Abbas through Kuraib and narrated by Ibn Juraij; despite its reliable chain, it contradicts the reports of Maymuna herself and Abu Rafi', so jurists labeled it shādhdh.",
    details: {
      source: "Sahih al-Bukhari",
      book: "Marriage",
      bookNumber: 67,
      chapter: "Marriage in ihram",
      grading: "Shādhdh",
      hadithNumber: 5159,
      location: "Hadith 5159",
    },
    chain: [
      { name: "Abdullah ibn Juraij", descriptor: "Meccan scholar", classification: "muhaddith", reliability: "saduq" },
      { name: "Kuraib mawla Ibn Abbas", descriptor: "Freedman of Ibn Abbas", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Abbas", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "saturday-fast-shadh",
    matn:
      "Do not fast on Saturday unless it coincides with an obligation; even if you find only the bark of a grapevine, chew it.",
    sanad:
      "Reported from Abdullah ibn Busr via his sister through the narrator Ash'ath ibn Sawwar; collected by Abu Dawud (Hadith 2421). Because reliable narrations permit voluntary fasts on Saturday, scholars such as Malik and al-Albani labeled this wording shādhdh.",
    details: {
      source: "Sunan Abi Dawud",
      book: "Fasting",
      bookNumber: 14,
      chapter: "Fasting on singled-out days",
      grading: "Shādhdh",
      hadithNumber: 2421,
      location: "Hadith 2421",
    },
    chain: [
      { name: "Ash'ath ibn Sawwar", descriptor: "Kufan narrator with odd reports", classification: "rawi", reliability: "layyin" },
      { name: "Abdullah ibn Busr", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Al-Samma' bint Busr", descriptor: "Companion woman", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "wudu-each-prayer-shadh",
    matn:
      "The Prophet ﷺ renewed ablution for every single prayer even if he still had ablution.",
    sanad:
      "Narrated from Anas ibn Malik via the narrator Abu Ghutayf and Abd al-Aziz ibn al-Mutalib; the report contradicts more authentic narrations from Anas and others showing he prayed multiple prayers with one ablution, so the hadith is classed as shādhdh.",
    details: {
      source: "Musnad Ahmad",
      book: "Musnad Anas ibn Malik",
      bookNumber: 21,
      chapter: "Ablution",
      grading: "Shādhdh",
      hadithNumber: 13469,
      location: "Hadith 13469",
    },
    chain: [
      { name: "Abd al-Aziz ibn al-Mutalib", descriptor: "Medinese narrator", classification: "rawi", reliability: "majhul_hal" },
      { name: "Abu Ghutayf", descriptor: "Narrator with limited precision", classification: "rawi", reliability: "majhul_ayn" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "basmala-audible-muallal",
    matn:
      "The Prophet ﷺ used to recite the basmala aloud in every prayer.",
    sanad:
      "Narrated from Ibn Umar through Nafi' and relayed by Ibn Jurayj; al-Daraqutni exposed a hidden defect showing Ibn Jurayj only heard it mursal from a student of Nafi', making the chain muʿallal despite its apparent soundness.",
    details: {
      source: "Al-Daraqutni, al-Ilal",
      book: "Prayer",
      bookNumber: 3,
      chapter: "Recitation of basmala",
      grading: "Muʿallal",
      hadithNumber: 125,
      location: "Entry 125",
    },
    chain: [
      { name: "Abdullah ibn al-Zubayr al-Humaydi", descriptor: "Meccan musnid", classification: "muhaddith", reliability: "thiqah" },
      { name: "Abd al-Malik ibn Abd al-Aziz ibn Jurayj", descriptor: "Meccan scholar", classification: "muhaddith", reliability: "saduq" },
      { name: "Nafi' mawla Ibn Umar", descriptor: "Freedman of Ibn Umar", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Umar", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad", "muannan"],
    narrationLevel: "gharib",
  },
  {
    id: "double-adhan-muallal",
    matn:
      "The Prophet ﷺ called for two adhans on Friday before the sermon.",
    sanad:
      "Attributed to Abu Huraira with a chain through Ibn Lahi'ah that outwardly appears connected, but Ibn Abi Hatim demonstrated that the narrator Abu Tamim was never known to meet Abu Huraira, so the report is muʿallal.",
    details: {
      source: "Al-Ilal Ibn Abi Hatim",
      book: "Prayer",
      bookNumber: 2,
      chapter: "Friday adhan",
      grading: "Muʿallal",
      hadithNumber: 823,
      location: "Entry 823",
    },
    chain: [
      { name: "Abdullah ibn Lahi'ah", descriptor: "Weak Egyptian judge", classification: "rawi", reliability: "layyin" },
      { name: "Abu Tamim al-Jayshani", descriptor: "Egyptian narrator", classification: "tabi", reliability: "saduq" },
      { name: "Abu Huraira", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "gharib",
  },
  {
    id: "raising-between-sujud-muallal",
    matn:
      "The Prophet ﷺ raised his hands between every prostration as he did at the opening takbir.",
    sanad:
      "Narrated from Ibn Mas'ud through Alqamah and transmitted by Sufyan al-Thawri; al-Daraqutni revealed that the reliable narrators related it without the addition of 'between every sujud', so the version is muʿallal.",
    details: {
      source: "Al-Daraqutni, al-Ilal",
      book: "Prayer",
      bookNumber: 3,
      chapter: "Raising the hands",
      grading: "Muʿallal",
      hadithNumber: 167,
      location: "Entry 167",
    },
    chain: [
      { name: "Sufyan al-Thawri", descriptor: "Kufan hadith master", classification: "muhaddith", reliability: "thiqah" },
      { name: "Alqamah ibn Qays", descriptor: "Senior tabi'i", classification: "tabi", reliability: "thiqah" },
      { name: "Abdullah ibn Mas'ud", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "aziz",
  },
  {
    id: "rajab-night-mawdu",
    matn:
      "Whoever prays one hundred rak'ahs on the night of the middle of Sha'ban will have intercession for every member of his household.",
    sanad:
      "Attributed to Ali ibn Abi Talib through the narrator Ibn Abi Sabrah, a known fabricator; Ibn al-Jawzi and Ibn Hibban declared the report mawḍūʿ.",
    details: {
      source: "Ibn al-Jawzi, al-Mawdu'at",
      book: "Prayer",
      bookNumber: 2,
      chapter: "Virtues of Sha'ban",
      grading: "Mawḍūʿ",
      hadithNumber: 373,
      location: "Entry 373",
    },
    chain: [
      { name: "Muhammad ibn Ibrahim ibn Abi Sabrah", descriptor: "Fabricator", classification: "rawi", reliability: "kadhdhab" },
      { name: "Ibrahim ibn Muhammad", descriptor: "Weak transmitter", classification: "rawi", reliability: "majhul_hal" },
      { name: "Ali ibn Abi Talib", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "mawlid-reward-mawdu",
    matn:
      "Whoever celebrates my birthday will be with me in Paradise.",
    sanad:
      "Cited by Ibn al-Jawzi with a chain containing Ahmad ibn Abdullah al-Juwaybari and Abd al-Wahhab ibn Abi al-Hasan, both accused of forging reports, so the hadith is mawḍūʿ.",
    details: {
      source: "Ibn al-Jawzi, al-Mawdu'at",
      book: "Virtues",
      bookNumber: 1,
      chapter: "Innovations",
      grading: "Mawḍūʿ",
      hadithNumber: 90,
      location: "Entry 90",
    },
    chain: [
      { name: "Ahmad ibn Abdullah al-Juwaybari", descriptor: "Confessed fabricator", classification: "rawi", reliability: "kadhdhab" },
      { name: "Abd al-Wahhab ibn Abi al-Hasan", descriptor: "Unknown narrator", classification: "rawi", reliability: "majhul_ayn" },
      { name: "Anas ibn Malik", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
  {
    id: "specific-dua-mawdu",
    matn:
      "Whoever recites the supplication 'Ya Qadiru' ten thousand times after Fajr will be relieved of every debt instantly.",
    sanad:
      "Attributed to Ibn Abbas through the narrator Sa'id ibn Qarun who does not exist in biographical works; al-Suyuti counted it among fabricated prayers.",
    details: {
      source: "Al-Suyuti, al-La'ali al-Masnu'a",
      book: "Supplications",
      bookNumber: 2,
      chapter: "Invented adhkar",
      grading: "Mawḍūʿ",
      hadithNumber: 512,
      location: "Entry 512",
    },
    chain: [
      { name: "Sa'id ibn Qarun", descriptor: "Unknown, likely invented", classification: "rawi", reliability: "majhul_ayn" },
      { name: "Ikrimah mawla Ibn Abbas", descriptor: "Meccan exegete", classification: "tabi", reliability: "saduq" },
      { name: "Abdullah ibn Abbas", descriptor: "Companion", classification: "sahabi", reliability: "thiqah" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
    sourceTypes: ["marfu"],
    chainTypes: ["musnad"],
    narrationLevel: "fard",
  },
];


const ICON_BUTTON_CLASSES =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[#e5f6ef] dark:bg-[#0f2f24] text-base text-[var(--text-secondary)] shadow-sm transition hover:-translate-y-0.5 hover:text-[var(--accent-emerald)]";
const FILTER_BUTTON_BASE =
  "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-emerald)]";

type ChatWorkspaceProps = {
  initialPrompt: string;
  onNewChat: () => void;
};

const createSeedMessages = (prompt: string): Message[] =>
  prompt
    ? [
        {
          id: "user-initial",
          role: "user",
          content: prompt,
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          id: "assistant-initial",
          role: "assistant",
          content:
            "I parsed your request and gathered sanad overlaps along with commentary layers. Ask follow-up questions or request visual comparisons.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]
    : [];

export function ChatWorkspace({ initialPrompt, onNewChat }: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    createSeedMessages(initialPrompt),
  );
  const [input, setInput] = useState("");
  const [hadithIndex, setHadithIndex] = useState<number | null>(null);
  const [expandedNarrators, setExpandedNarrators] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [expandedMatnIds, setExpandedMatnIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [selectedGradings, setSelectedGradings] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isGradingMenuOpen, setIsGradingMenuOpen] = useState(false);
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isNarrationDetailsOpen, setIsNarrationDetailsOpen] = useState(false);

  const previousLeftWidth = useRef(leftWidth);
  const gradingMenuRef = useRef<HTMLDivElement | null>(null);
  const bookMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  const leftWidthInitialized = useRef(false);
  const rightWidthInitialized = useRef(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const setMatch = () => setIsDesktop(mediaQuery.matches);

    setMatch();
    mediaQuery.addEventListener("change", setMatch);

    return () => mediaQuery.removeEventListener("change", setMatch);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (gradingMenuRef.current && !gradingMenuRef.current.contains(target)) {
        setIsGradingMenuOpen(false);
      }
      if (bookMenuRef.current && !bookMenuRef.current.contains(target)) {
        setIsBookMenuOpen(false);
      }
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(target)) {
        setIsSourceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const timestamp = new Date().toLocaleTimeString();
    setMessages((prev) => [
      ...prev,
      { id: `user-${prev.length}`, role: "user", content: trimmed, timestamp },
      {
        id: `assistant-${prev.length}`,
        role: "assistant",
        content:
          "Here is a synthesized response referencing the narrations and highlighting sanad integrity. (Placeholder response until backend is wired.)",
        timestamp,
      },
    ]);
    setInput("");
  };

  const currentHadith = useMemo(() => {
    if (hadithIndex === null) return null;
    return hadithInsights[hadithIndex] ?? null;
  }, [hadithIndex]);
  const currentGradingStyle = currentHadith
    ? getGradingStyle(currentHadith.details.grading)
    : null;
  const formattedCurrentGrading = currentHadith
    ? formatGradingLabel(currentHadith.details.grading)
    : "";
  const nonProphetNarratorCount = currentHadith
    ? currentHadith.chain.filter((node) => node.type !== "prophet").length
    : 0;
  const activeSourceTypes = currentHadith
    ? sourceTypeInfo.filter((item) => currentHadith.sourceTypes.includes(item.key))
    : [];
  const activeChainTypes = currentHadith
    ? chainTypeInfo.filter((item) => currentHadith.chainTypes.includes(item.key))
    : [];
  const currentNarrationLevelInfo = currentHadith
    ? narrationLevelInfo[currentHadith.narrationLevel]
    : null;
  const currentSourceAuthor = currentHadith
    ? sourceAuthorMap[currentHadith.details.source] ?? null
    : null;

  const hadithIndexById = useMemo(() => {
    return hadithInsights.reduce<Record<string, number>>((acc, hadith, index) => {
      acc[hadith.id] = index;
      return acc;
    }, {});
  }, []);

  const gradingOptions = useMemo(
    () =>
      Array.from(new Set(hadithInsights.map((hadith) => hadith.details.grading))),
    [],
  );

  const bookOptions = useMemo(
    () => Array.from(new Set(hadithInsights.map((hadith) => hadith.details.book))),
    [],
  );

  const sourceOptions = useMemo(
    () => Array.from(new Set(hadithInsights.map((hadith) => hadith.details.source))),
    [],
  );

  const filteredHadiths = useMemo(
    () =>
      hadithInsights.filter((hadith) => {
        if (
          selectedGradings.size > 0 &&
          !selectedGradings.has(hadith.details.grading)
        ) {
          return false;
        }
        if (selectedBooks.size > 0 && !selectedBooks.has(hadith.details.book)) {
          return false;
        }
        if (
          selectedSources.size > 0 &&
          !selectedSources.has(hadith.details.source)
        ) {
          return false;
        }
        return true;
      }),
    [selectedGradings, selectedBooks, selectedSources],
  );

  useEffect(() => {
    if (!filteredHadiths.length) {
      setHadithIndex(null);
      return;
    }
    if (hadithIndex === null) return;
    const selectedId = hadithInsights[hadithIndex]?.id;
    if (!selectedId) {
      setHadithIndex(null);
      return;
    }
    const stillVisible = filteredHadiths.some((hadith) => hadith.id === selectedId);
    if (!stillVisible) {
      setHadithIndex(null);
    }
  }, [filteredHadiths, hadithIndex]);

  const LEFT_MIN = 260;
  const LEFT_MAX = 640;
  const LEFT_DEFAULT_RATIO = 0.3;
  const RIGHT_MIN = 360;
  const RIGHT_MAX = 520;
  const RIGHT_DEFAULT_RATIO = 0.35;
  const COLLAPSED_WIDTH = 72;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const effectiveLeftWidth = leftCollapsed ? COLLAPSED_WIDTH : leftWidth;
  const effectiveRightWidth = rightWidth;

  useEffect(() => {
    if (!isDesktop || leftCollapsed || leftWidthInitialized.current) return;
    const idealWidth = clamp(
      window.innerWidth * LEFT_DEFAULT_RATIO,
      LEFT_MIN,
      LEFT_MAX,
    );
    setLeftWidth(idealWidth);
    previousLeftWidth.current = idealWidth;
    leftWidthInitialized.current = true;
  }, [isDesktop, leftCollapsed]);

  useEffect(() => {
    if (!isDesktop || rightWidthInitialized.current) return;
    const idealWidth = clamp(
      window.innerWidth * RIGHT_DEFAULT_RATIO,
      RIGHT_MIN,
      RIGHT_MAX,
    );
    setRightWidth(idealWidth);
    rightWidthInitialized.current = true;
  }, [isDesktop]);

  const dragState = useRef<{
    panel: "left" | "right";
    startX: number;
    startWidth: number;
    min: number;
    max: number;
  } | null>(null);

  const startResize = useCallback(
    (panel: "left" | "right") => (event: React.MouseEvent) => {
      if (!isDesktop) return;
      if (panel === "left" && leftCollapsed) return;
      event.preventDefault();
      dragState.current = {
        panel,
        startX: event.clientX,
        startWidth: panel === "left" ? leftWidth : rightWidth,
        min: panel === "left" ? LEFT_MIN : RIGHT_MIN,
        max: panel === "left" ? LEFT_MAX : RIGHT_MAX,
      };
      document.body.style.userSelect = "none";
    },
    [isDesktop, leftCollapsed, leftWidth, rightWidth],
  );

  useEffect(() => {
    if (!isDesktop) return undefined;
    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      event.preventDefault();
      const delta = event.clientX - drag.startX;
      const nextWidth = clamp(drag.startWidth + delta, drag.min, drag.max);
      if (drag.panel === "left") {
        setLeftWidth(nextWidth);
      } else {
        setRightWidth(nextWidth);
      }
    };

    const handleMouseUp = () => {
      if (dragState.current) {
        dragState.current = null;
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDesktop]);

  const handleToggleLeft = () => {
    if (leftCollapsed) {
      setLeftCollapsed(false);
      setLeftWidth(
        clamp(previousLeftWidth.current ?? LEFT_MIN, LEFT_MIN, LEFT_MAX),
      );
    } else {
      previousLeftWidth.current = leftWidth;
      setLeftCollapsed(true);
      setLeftWidth(COLLAPSED_WIDTH);
    }
  };

  const handleCardClick = (id: string) => {
    const index = hadithIndexById[id];
    if (typeof index === "number") {
      setHadithIndex(index);
    }
    setExpandedNarrators(new Set<string>());
    setExpandedMatnIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleNarrator = (name: string) => {
    setExpandedNarrators((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  useEffect(() => {
    setIsNarrationDetailsOpen(false);
  }, [hadithIndex]);

  const toggleSetValue = (
    value: string,
    setter: Dispatch<SetStateAction<Set<string>>>,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  };


  return (
    <section
      className="grid min-h-svh w-full grid-cols-1 bg-[var(--background)] transition-[grid-template-columns] duration-300 lg:grid-cols-[25%_40%_35%]"
      style={
        isDesktop
          ? {
              gridTemplateColumns: `${effectiveLeftWidth}px minmax(480px, 1fr) ${effectiveRightWidth}px`,
            }
          : undefined
      }
    >
      <aside className="scrollbar-hide relative flex max-h-svh flex-col gap-7 overflow-y-auto border-r border-[var(--border-soft)] bg-transparent px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          {!leftCollapsed && (
              <div className="flex flex-1 items-center justify-between gap-3">
              <Logo className="scale-90 transform" />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onNewChat}
                  className={ICON_BUTTON_CLASSES}
                  aria-label="Start a new chat"
                >
                  ✦
                </button>
                <ThemeToggle className="hover:-translate-y-0.5" />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleToggleLeft}
            className={ICON_BUTTON_CLASSES}
            aria-label={leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {leftCollapsed ? "→" : "←"}
          </button>
        </div>
        {!leftCollapsed && (
          <>
            <header className="space-y-1">
              <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap sm:gap-3">
                <div className="flex flex-col whitespace-nowrap">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Hadiths
                  </p>
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {filteredHadiths.length} results
                  </p>
                </div>
                <div className="flex flex-nowrap items-center gap-2 sm:gap-3">
                  <div className="relative" ref={gradingMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsGradingMenuOpen((open) => !open)}
                      className={`${FILTER_BUTTON_BASE} ${
                        selectedGradings.size > 0
                          ? "border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]"
                          : "border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span>Grade</span>
                      <span className="text-xs">▾</span>
                    </button>
                    {isGradingMenuOpen && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-popover)] p-3 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                          Select grade
                        </p>
                        <div className="mt-2 space-y-1">
                          {gradingOptions.map((grade) => (
                            <label
                              key={grade}
                              className="flex items-start gap-2 rounded-xl px-2 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel)]"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--border-soft)] text-[var(--accent-emerald)] focus:ring-[var(--accent-emerald)]"
                                checked={selectedGradings.has(grade)}
                                onChange={() =>
                                  toggleSetValue(grade, setSelectedGradings)
                                }
                              />
                              <span className="flex-1 whitespace-normal break-words text-left leading-snug">
                                {grade}
                              </span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedGradings(new Set<string>())}
                          className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={bookMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsBookMenuOpen((open) => !open)}
                      className={`${FILTER_BUTTON_BASE} ${
                        selectedBooks.size > 0
                          ? "border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]"
                          : "border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span>Book</span>
                      <span className="text-xs">▾</span>
                    </button>
                    {isBookMenuOpen && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-popover)] p-3 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                          Select book
                        </p>
                        <div className="mt-2 space-y-1">
                          {bookOptions.map((book) => (
                            <label
                              key={book}
                              className="flex items-start gap-2 rounded-xl px-2 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel)]"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--border-soft)] text-[var(--accent-emerald)] focus:ring-[var(--accent-emerald)]"
                                checked={selectedBooks.has(book)}
                                onChange={() =>
                                  toggleSetValue(book, setSelectedBooks)
                                }
                              />
                              <span className="flex-1 whitespace-normal break-words text-left leading-snug">
                                {book}
                              </span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedBooks(new Set<string>())}
                          className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={sourceMenuRef}>
                    <button
                      type="button"
                      onClick={() => setIsSourceMenuOpen((open) => !open)}
                      className={`${FILTER_BUTTON_BASE} ${
                        selectedSources.size > 0
                          ? "border-[var(--accent-emerald)] bg-[var(--accent-emerald)]/15 text-[var(--accent-emerald)]"
                          : "border-[var(--border-soft)] bg-[var(--surface-card)] text-[var(--text-muted)]"
                      }`}
                    >
                      <span>Source</span>
                      <span className="text-xs">▾</span>
                    </button>
                    {isSourceMenuOpen && (
                      <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-popover)] p-3 shadow-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-muted)]">
                          Select source
                        </p>
                        <div className="mt-2 space-y-1">
                          {sourceOptions.map((source) => (
                            <label
                              key={source}
                              className="flex items-start gap-2 rounded-xl px-2 py-1 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-panel)]"
                            >
                              <input
                                type="checkbox"
                                className="rounded border-[var(--border-soft)] text-[var(--accent-emerald)] focus:ring-[var(--accent-emerald)]"
                                checked={selectedSources.has(source)}
                                onChange={() =>
                                  toggleSetValue(source, setSelectedSources)
                                }
                              />
                              <span className="flex-1 whitespace-normal break-words text-left leading-snug">
                                {source}
                              </span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSources(new Set<string>())}
                          className="mt-3 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>
            <div className="space-y-6">
              {filteredHadiths.length > 0 ? (
                filteredHadiths.map((hadith) => {
                  const isActive = currentHadith?.id === hadith.id;
                  const isExpanded = expandedMatnIds.has(hadith.id);
                  const gradingStyle = getGradingStyle(hadith.details.grading);
                  const gradingLabel = formatGradingLabel(hadith.details.grading);
                  const truncated =
                    hadith.matn.length > 220
                      ? `${hadith.matn.slice(0, 220)}…`
                      : hadith.matn;
                  const matnPreview = isExpanded ? hadith.matn : truncated;
                  return (
                    <article
                      key={hadith.id}
                      onClick={() => handleCardClick(hadith.id)}
                      className={`cursor-pointer rounded-3xl border bg-[var(--workspace-card-bg)] px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        isActive
                          ? "border-[var(--accent-emerald)] shadow-lg"
                          : "border-[var(--workspace-card-border)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#1fb276]">
                            {hadith.details.location}
                          </p>
                          <p className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                            {hadith.details.book}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${
                            isActive
                              ? "text-[#1fb276]"
                              : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {hadith.details.source}
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                          {matnPreview}
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]"
                          style={{
                            backgroundColor: gradingStyle.background,
                            color: gradingStyle.color,
                          }}
                        >
                          {gradingLabel}
                        </span>
                        <span className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          {hadith.details.chapter}
                        </span>
                        <span className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                          Book {hadith.details.bookNumber}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No hadith match the selected filters.</p>
              )}
            </div>
          </>
        )}
        {isDesktop && !leftCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            className="pointer-events-auto absolute right-0 top-0 hidden h-full w-2 translate-x-1/2 cursor-col-resize lg:block"
            onMouseDown={startResize("left")}
          >
            <span className="absolute inset-0 rounded-full bg-white/5" />
          </div>
        )}
      </aside>

      <div className="relative flex max-h-svh flex-col border-r border-[var(--border-soft)] bg-[var(--background)]">
        <header className="border-b border-[var(--border-soft)] px-8 py-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Conversation
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            System streams insights, sanad graphs, and commentary context in
            real time.
          </p>
        </header>
        <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-8 py-6">
          {messages.map((message) => (
            <article
              key={message.id}
              className={`flex flex-col ${
                message.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[90%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === "user"
                    ? "bg-[var(--accent-emerald)] text-[var(--accent-contrast)] border-transparent"
                    : "bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-soft)]"
                }`}
              >
                {message.content}
              </div>
              <span className="mt-1 text-xs text-[var(--text-subtle)]">
                {message.role === "user" ? "You" : "Riwayyaat Copilot"} ·{" "}
                {message.timestamp}
              </span>
            </article>
          ))}
        </div>
        <footer className="border-t border-[var(--border-soft)] px-8 py-5">
          <form
            className="flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSend();
            }}
          >
            <label className="sr-only" htmlFor="workspace-input">
              Continue the conversation
            </label>
            <input
              id="workspace-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about narrators, sanad overlaps, or commentary..."
              className="flex-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-emerald)] focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-2xl bg-[var(--accent-emerald)] px-5 py-3 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90"
            >
              Send
            </button>
          </form>
        </footer>
        {isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            className="pointer-events-auto absolute right-0 top-0 hidden h-full w-2 translate-x-1/2 cursor-col-resize lg:block"
            onMouseDown={startResize("right")}
          >
            <span className="absolute inset-0 rounded-full bg-white/5" />
          </div>
        )}
      </div>

      <aside className="scrollbar-hide relative flex max-h-svh flex-col overflow-y-auto bg-[var(--background-alt)] px-6 py-8">
        <header className="flex items-center justify-between gap-2">
          <div>
            {currentHadith ? (
              <>
                <h3 className="text-lg font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
                  {currentHadith.details.source}
                </h3>
                <p className="text-sm font-semibold text-[var(--text-secondary)]">
                  Book {currentHadith.details.bookNumber}, Hadith {currentHadith.details.hadithNumber}
                </p>
              </>
            ) : (
              <h3 className="text-lg font-semibold text-[var(--text-secondary)]">
                Select a hadith to view isnad
              </h3>
            )}
          </div>
          {currentHadith && (
            <div className="flex flex-col items-end gap-1 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="px-3 py-1 text-right text-xs font-semibold text-[var(--text-secondary)]">
                {currentSourceAuthor ? (
                  <>
                    <span className="block text-[var(--text-primary)]">
                      {currentSourceAuthor.name}
                    </span>
                    <span className="mt-1 inline-block rounded-full bg-[var(--surface-card)] px-2 py-0.5 text-[0.7rem] font-semibold text-[var(--text-primary)] dark:bg-[var(--surface-card)]/60 dark:text-white">
                      {currentSourceAuthor.lifespan}
                    </span>
                  </>
                ) : (
                  "Author not specified"
                )}
              </span>
            </div>
          )}
        </header>

        {currentHadith ? (
          <>
            <div className="my-4 h-px w-full bg-[var(--border-soft)]" />
            <div className="scrollbar-hide mt-4 space-y-6 overflow-y-auto pr-2">
              <section className="grid gap-4 text-left text-xs text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Narration Level
                  </p>
                  {currentNarrationLevelInfo ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setIsNarrationDetailsOpen((prev) => !prev)
                        }
                        className="mt-1 flex w-full items-center justify-between text-sm font-semibold text-[var(--text-primary)]"
                      >
                        {currentNarrationLevelInfo.title}
                        <span className="text-[var(--text-muted)] text-xs">
                          {isNarrationDetailsOpen ? "▴" : "▾"}
                        </span>
                      </button>
                      {isNarrationDetailsOpen && (
                        <div className="mt-1 space-y-1 text-[var(--text-secondary)]">
                          {currentNarrationLevelInfo.secondary && (
                            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              {currentNarrationLevelInfo.secondary}
                            </p>
                          )}
                          <p>{currentNarrationLevelInfo.description}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Not classified
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-secondary)]">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Attribution Type
                  </p>
                  <div className="mt-1 space-y-2">
                    {(activeSourceTypes.length
                      ? activeSourceTypes
                      : [
                          {
                            key: "none",
                            title: "Not specified",
                            description:
                              "No source classification provided.",
                          },
                        ]
                    ).map((item) => (
                      <DisclosureRow
                        key={item.title}
                        title={item.title}
                        secondary={item.secondary}
                      >
                        {item.description}
                      </DisclosureRow>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-3 text-[var(--text-secondary)]">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Chain Type
                  </p>
                  <div className="mt-1 space-y-2">
                    {(activeChainTypes.length
                      ? activeChainTypes
                      : [
                          {
                            key: "none",
                            title: "Not specified",
                            description:
                              "No chain classification provided.",
                          },
                        ]
                    ).map((item) => (
                      <DisclosureRow
                        key={item.title}
                        title={item.title}
                        secondary={item.secondary}
                      >
                        {item.description}
                      </DisclosureRow>
                    ))}
                  </div>
                </div>
              </section>
              <div className="text-center text-xs text-[var(--text-secondary)]">
                <span
                  className="mt-2 inline-flex rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                  style={
                    currentGradingStyle
                      ? {
                        backgroundColor: currentGradingStyle.background,
                        color: currentGradingStyle.color,
                        boxShadow: `0 10px 25px ${currentGradingStyle.background}1a`,
                      }
                      : undefined
                  }
                >
                  {formattedCurrentGrading}
                </span>
                {currentGradingStyle?.description && (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {currentGradingStyle.description}
                  </p>
                )}
              </div>
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Isnad chain
                  </h4>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {nonProphetNarratorCount} narrators
                  </span>
                </div>
              <ul className="mt-4 space-y-5">
                {currentHadith.chain.map((node, index) => {
                  const isProphet = node.type === "prophet";
                  const isExpanded = expandedNarrators.has(node.name);
                  const tierInfo =
                    !isProphet && node.classification
                      ? narratorTierInfo[node.classification]
                      : null;
                  const tierLabel = tierInfo?.title
                    ? tierInfo.title.split(" (")[0]
                    : node.descriptor;
                  const reliabilityInfo =
                    !isProphet && node.reliability
                      ? reliabilityTierInfo[node.reliability]
                      : null;
                  const nodeLifespan = narratorLifespans[node.name] ?? node.lifespan;
                  const connectorColor = !isProphet && reliabilityInfo
                    ? reliabilityInfo.background
                    : "var(--border-soft)";
                  const methodInfo = transmissionMethods[index % transmissionMethods.length];
                  const baseClasses = isProphet
                    ? "bg-gradient-to-r from-[#0b7a6c] to-[#1b4332] text-white border-transparent shadow-lg"
                    : isExpanded
                      ? "border-[var(--accent-emerald)] bg-[var(--background)]"
                      : "border-[var(--border-soft)] bg-[var(--background)]";
                  return (
                    <li key={node.name} className="relative pl-6">
                      {!isProphet && (
                        <span
                          className="absolute left-3 top-[10%] h-[80%] w-[2px]"
                          style={{ backgroundColor: connectorColor }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isProphet) return;
                          handleToggleNarrator(node.name);
                        }}
                        className={`relative w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${baseClasses}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              {!isProphet && (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 text-[0.7rem] text-[var(--accent-emerald)]">
                                  {index + 1}
                                </span>
                              )}
                              <div>
                                <p className="text-sm font-semibold text-[color:inherit]">
                                  {node.name}
                                </p>
                                <p
                                  className={`mt-0.5 text-xs ${
                                    isProphet ? "text-white/80" : "text-[var(--text-muted)]"
                                  }`}
                                >
                                  {isProphet ? node.descriptor : tierLabel}
                                </p>
                              </div>
                            </div>
                          </div>
                          {!isProphet && (
                            <div className="flex flex-col items-center gap-1">
                              {reliabilityInfo && (
                                <span
                                  className="rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em]"
                                  style={{
                                    backgroundColor: reliabilityInfo.background,
                                    color: reliabilityInfo.color,
                                  }}
                                >
                                  {reliabilityInfo.badge}
                                </span>
                              )}
                              {nodeLifespan && (
                                <span className="text-[0.65rem] font-semibold text-[var(--text-primary)] dark:text-white">
                                  {nodeLifespan}
                                </span>
                              )}
                            </div>
                          )}
                          {isProphet ? (
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/30 text-xl text-white shadow-[0_8px_25px_rgba(255,255,255,0.35)] ring-2 ring-white/40 animate-pulse">
                              ﷺ
                            </span>
                          ) : (
                            <span className="text-lg">
                              {isExpanded ? "−" : "+"}
                            </span>
                          )}
                        </div>
                        {!isProphet && isExpanded && (
                          <div className="mt-3 space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                            <div>
                              <p className="font-semibold text-[var(--text-primary)]">
                                Generational Rank:{" "}
                                <span className="text-[var(--text-primary)]">
                                  {tierInfo?.title ?? "Narrator"}
                                </span>
                                {tierInfo?.secondary && (
                                  <span className="ml-2 text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    {tierInfo.secondary}
                                  </span>
                                )}
                              </p>
                              <p>
                                {tierInfo?.description ??
                                  "Narration role pending further classification."}
                              </p>
                            </div>
                            {reliabilityInfo && (
                              <div>
                                <p className="font-semibold text-[var(--text-primary)]">
                                  Reliability Rank:{" "}
                                  <span className="text-[var(--text-primary)]">
                                    {reliabilityInfo.title}
                                  </span>
                                </p>
                                {reliabilityInfo.secondary && (
                                  <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                    {reliabilityInfo.secondary}
                                  </p>
                                )}
                                <p>{reliabilityInfo.description}</p>
                              </div>
                            )}
                            {methodInfo && (
                              <div>
                                <p className="font-semibold text-[var(--text-primary)]">
                                  Transmission Method:{" "}
                                  <span className="text-[var(--text-primary)]">
                                    {methodInfo.title}
                                  </span>
                                </p>
                                <p className="text-[var(--text-secondary)]">
                                  {methodInfo.description}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {!isProphet && methodInfo && (
                          <div
                            className="pointer-events-none absolute bottom-0 left-1/2 h-6 w-28 -translate-x-1/2 translate-y-1/2 overflow-hidden rounded-full border border-[var(--border-soft)] bg-[#dbeafe] text-center text-[0.55rem] font-semibold uppercase text-[#0f172a] shadow-sm dark:bg-[#1e293b] dark:text-white"
                            title={methodInfo.description}
                          >
                            <span className="flex h-full w-full items-center justify-center">
                              {methodInfo.title}
                            </span>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-5 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">
              No hadith selected
            </p>
            <p className="mt-2 leading-relaxed">
              Choose a hadith card on the left to preview its matn excerpt and view the full isnad chain here.
            </p>
          </div>
        )}
        {isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            className="pointer-events-auto absolute left-0 top-0 hidden h-full w-2 -translate-x-1/2 cursor-col-resize lg:block"
            onMouseDown={startResize("right")}
          >
            <span className="absolute inset-0 rounded-full bg-white/5" />
          </div>
        )}
      </aside>
    </section>
  );
}
const DisclosureRow = ({
  title,
  secondary,
  children,
}: {
  title: string;
  secondary?: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-semibold text-[var(--text-primary)]"
      >
        {title}
        <span className="text-xs text-[var(--text-muted)]">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div className="space-y-1 text-[var(--text-secondary)]">
          {secondary && (
            <p className="text-[0.65rem] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {secondary}
            </p>
          )}
          <p>{children}</p>
        </div>
      )}
    </div>
  );
};
