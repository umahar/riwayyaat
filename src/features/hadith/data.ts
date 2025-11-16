import { HadithInsight } from "./types";

export const hadithInsights: HadithInsight[] = [
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
    gradedBy: [
      { name: "Imam al-Bukhari", lifespan: "194–256 AH", gradeTitle: "Ṣaḥīḥ li-dhātih", isPrimary: true },
      { name: "Al-Albani", lifespan: "1914–1999 CE", gradeTitle: "Ṣaḥīḥ" },
      { name: "Ibn Hajar al-Asqalani", lifespan: "773–852 AH", gradeTitle: "Ḥasan li-ghayrih" },
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
