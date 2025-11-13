"use client";

import {
  Dispatch,
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
    descriptor: string;
    bio?: string;
    type?: "prophet";
  }>;
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
      description: "Fully authentic; strongest type of hadith.",
    },
  },
  {
    keywords: ["sahih li ghayrih", "ṣaḥīḥ li ghayrih"],
    style: {
      background: "#15803d",
      color: "#ecfdf5",
      description: "Authentic due to supporting chains.",
    },
  },
  {
    keywords: ["hasan li dhatih", "ḥasan li dhātih"],
    style: {
      background: "#65a30d",
      color: "#041b11",
      description: "Reliable though narrators have slightly weaker memory.",
    },
  },
  {
    keywords: ["hasan li ghayrih", "ḥasan li ghayrih"],
    style: {
      background: "#ca8a04",
      color: "#041b11",
      description: "Weak alone but strengthened by other chains.",
    },
  },
  {
    keywords: ["daif jiddan", "ḍaʿīf jiddan", "very weak"],
    style: {
      background: "#c2410c",
      color: "#fff7ed",
      description: "Very weak; serious problems in the chain.",
    },
  },
  {
    keywords: ["daif", "ḍaʿīf", "weak"],
    style: {
      background: "#ea580c",
      color: "#fff7ed",
      description: "Weak due to memory issues or disconnections.",
    },
  },
  {
    keywords: ["munkar", "shadh", "shadhdh", "maqlub"],
    style: {
      background: "#991b1b",
      color: "#fee2e2",
      description: "Rejected because it contradicts stronger reports.",
    },
  },
  {
    keywords: ["mawdu", "mawḍūʿ", "fabricated"],
    style: {
      background: "#111827",
      color: "#f8fafc",
      description: "Fabricated or invented; not from the Prophet.",
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
const hadithInsights: HadithInsight[] = [
  {
    id: "sahih-dhatih",
    matn:
      "Actions are judged by intentions, and every person will have exactly what they intended. Whoever migrates seeking Allah and His Messenger, then his migration is truly for Allah and His Messenger; and whoever migrates for worldly gain or marriage will have only that for which he migrated.",
    sanad:
      "Narrated by Umar ibn al-Khattab, transmitted by Alqamah ibn Waqqas, narrated by Muhammad ibn Ibrahim al-Taymi, reported by Yahya ibn Bukayr, collected by Imam al-Bukhari.",
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
      { name: "Yahya ibn Bukayr", descriptor: "Primary transmitter" },
      { name: "Layth ibn Sa'd", descriptor: "Egyptian scholar" },
      { name: "Muhammad ibn Ibrahim al-Taymi", descriptor: "Medinese scholar" },
      { name: "Alqamah ibn Waqqas", descriptor: "Companion student" },
      { name: "Umar ibn al-Khattab", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "sahih-ghayrih",
    matn:
      "The believer is not stung from the same hole twice; experience teaches him caution while he remains trusting in his Lord. He is insightful without being suspicious and relies upon Allah while taking lessons from harm that has touched him.",
    sanad:
      "Narrated by Abu Huraira, transmitted by Al-A'raj, narrated by Abu Zinad, reported by Sufyan al-Thawri with corroborating chains preserved by Imam Muslim.",
    details: {
      source: "Sahih Muslim",
      book: "Virtues",
      bookNumber: 45,
      chapter: "Against heedlessness",
      grading: "Ṣaḥīḥ li-ghayrih",
      hadithNumber: 2998,
      location: "Hadith 2998",
    },
    chain: [
      { name: "Abu Khaythamah", descriptor: "Narrator" },
      { name: "Sufyan al-Thawri", descriptor: "Kufan hadith master" },
      { name: "Abu Zinad", descriptor: "Medinese jurist" },
      { name: "Al-A'raj", descriptor: "Tabi'i" },
      { name: "Abu Huraira", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "hasan-dhatih",
    matn:
      "The world is pleasant and green, and Allah has made you successors therein to observe how you will act. So guard yourselves against the glitter of the world and against temptation, for the first trial of the Children of Israel was concerning women and attachment to comfort.",
    sanad:
      "Narrated by Abu Sa'id al-Khudri, transmitted by Abu Salih, narrated by Qatadah ibn Di'ama, reported by Shu'ba ibn al-Hajjaj, collected by Imam al-Tirmidhi.",
    details: {
      source: "Jami' al-Tirmidhi",
      book: "Zuhd",
      bookNumber: 36,
      chapter: "Warnings regarding dunya",
      grading: "Ḥasan li-dhātih",
      hadithNumber: 1209,
      location: "Hadith 1209",
    },
    chain: [
      { name: "Qutaybah ibn Sa'id", descriptor: "Primary transmitter" },
      { name: "Shu'ba ibn al-Hajjaj", descriptor: "Basran hadith master" },
      { name: "Qatadah ibn Di'ama", descriptor: "Exegete" },
      { name: "Abu Salih", descriptor: "Narrator" },
      { name: "Abu Sa'id al-Khudri", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "hasan-ghayrih",
    matn:
      "Whoever provides a fasting person something with which to break his fast will receive the same reward as the fasting person without the fasting person’s reward being diminished in the least. Even a sip of milk or a date counts, and it cultivates love between believers.",
    sanad:
      "Narrated by Zayd ibn Khalid al-Juhani, transmitted by 'Ata ibn Yasar, narrated by Hisham ibn Sa'd with corroborations, collected by Ibn Majah and strengthened by supporting chains.",
    details: {
      source: "Sunan Ibn Majah",
      book: "Fasting",
      bookNumber: 7,
      chapter: "Virtue of feeding the fasting",
      grading: "Ḥasan li-ghayrih",
      hadithNumber: 1746,
      location: "Hadith 1746",
    },
    chain: [
      { name: "Muhammad ibn Yahya", descriptor: "Primary transmitter" },
      { name: "Hisham ibn Sa'd", descriptor: "Medinese narrator" },
      { name: "'Ata ibn Yasar", descriptor: "Scholar of Madinah" },
      { name: "Zayd ibn Khalid al-Juhani", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "daif",
    matn:
      "When the servant says, ‘O Allah, to You belongs all praise filling the heavens, the earth, and whatever You will besides them,’ the angels find his words too weighty to contain. They ascend in awe and the praise is written as expansive reward despite the weakness in the chain relating it.",
    sanad:
      "Narrated by Anas ibn Malik, transmitted by Abu Qilabah, narrated by Abdullah ibn 'Awn with a weak connection to Anas, recorded by Imam Ahmad.",
    details: {
      source: "Musnad Ahmad",
      book: "Musnad al-Ansar",
      bookNumber: 34,
      chapter: "Narrations of Anas",
      grading: "Ḍaʿīf",
      hadithNumber: 12744,
      location: "Hadith 12744",
    },
    chain: [
      { name: "Abu Mu'awiyah", descriptor: "Kufi narrator" },
      { name: "Abdullah ibn 'Awn", descriptor: "Basran narrator" },
      { name: "Abu Qilabah", descriptor: "Follower" },
      { name: "Anas ibn Malik", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "daif-jiddan",
    matn:
      "Whoever memorizes forty hadith for my nation will be resurrected as a jurist and scholar on the Day of Resurrection, seated with the righteous. The report promises lofty ranks for collectors, yet its chain is very weak and the pious relied instead on sounder encouragements to teach knowledge.",
    sanad:
      "Attributed to Ibn 'Umar with a chain containing Nafi' ibn al-Harith and Muhammad ibn al-Fadl, both severely weak, as recorded by al-Daraqutni.",
    details: {
      source: "Al-Daraqutni",
      book: "Fada'il",
      bookNumber: 50,
      chapter: "Virtues of transmitters",
      grading: "Ḍaʿīf Jiddan",
      hadithNumber: 32,
      location: "Hadith 32",
    },
    chain: [
      { name: "Muhammad ibn al-Fadl", descriptor: "Severely weak narrator" },
      { name: "Nafi' ibn al-Harith", descriptor: "Unknown narrator" },
      { name: "Ibn 'Umar", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "munkar",
    matn:
      "Whoever prays after 'Asr until Maghrib will have the deeds of Prophets multiplied for him tenfold, a claim that contradicts authentic reports forbidding voluntary prayer at that time. Because the narration opposes stronger evidence, the scholars labeled it munkar and warned students against relying upon it.",
    sanad:
      "Reported from Anas ibn Malik through 'Abd al-Rahman ibn Ziyad al-Afrīqi from Salim ibn 'Atiyah; declared munkar due to contradictions by the critics.",
    details: {
      source: "Shu'ab al-Iman",
      book: "Optional Prayers",
      bookNumber: 24,
      chapter: "Praying after 'Asr",
      grading: "Munkar / Shādhdh / Maqlūb",
      hadithNumber: 3221,
      location: "Hadith 3221",
    },
    chain: [
      { name: "Abd al-Rahman ibn Ziyad al-Afrīqi", descriptor: "Weak narrator" },
      { name: "Salim ibn 'Atiyah", descriptor: "Narrator" },
      { name: "Anas ibn Malik", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
  {
    id: "mawdu",
    matn:
      "Whoever eats onions on Friday, his sins fall like autumn leaves and Paradise becomes obligatory for him that day, a fabricated promise inserted by forgers to promote a local custom. The early critics exposed the inventors and reminded the community that fabricated praise cannot transform disliked acts into worship.",
    sanad:
      "Attributed to Abu Musa al-Ash'ari via Isma'il ibn Yahya al-Madani and Muhammad ibn al-Hajjaj al-Lakhmi, both accused of fabrication, cited by Ibn al-Jawzi.",
    details: {
      source: "Al-Mawdu'at",
      book: "Fabricated Promises",
      bookNumber: 12,
      chapter: "Virtues fabricated regarding foods",
      grading: "Mawḍūʿ",
      hadithNumber: 178,
      location: "Hadith 178",
    },
    chain: [
      { name: "Isma'il ibn Yahya al-Madani", descriptor: "Identified fabricator" },
      { name: "Muhammad ibn al-Hajjaj al-Lakhmi", descriptor: "Accused narrator" },
      { name: "Abu Musa al-Ash'ari", descriptor: "Companion" },
      { name: "Muhammad ibn Abdullah", descriptor: "Messenger of Allah", type: "prophet" },
    ],
  },
];

const ICON_BUTTON_CLASSES =
  "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] text-base text-[var(--text-secondary)] shadow-sm transition hover:-translate-y-0.5 hover:text-[var(--accent-emerald)]";
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

  const previousLeftWidth = useRef(leftWidth);
  const gradingMenuRef = useRef<HTMLDivElement | null>(null);
  const bookMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  const leftWidthInitialized = useRef(false);
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
                          className={`rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
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
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1">
                {nonProphetNarratorCount} narrators
              </span>
              <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1">
                {currentHadith.details.chapter}
              </span>
            </div>
          )}
        </header>

        {currentHadith ? (
          <div className="scrollbar-hide mt-6 space-y-6 overflow-y-auto pr-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className="rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                style={
                  currentGradingStyle
                    ? {
                        backgroundColor: currentGradingStyle.background,
                        color: currentGradingStyle.color,
                        boxShadow: `0 10px 25px ${currentGradingStyle.background}33`,
                      }
                    : undefined
                }
              >
                {formattedCurrentGrading}
              </span>
              {currentGradingStyle?.description && (
                <p className="max-w-sm text-xs text-[var(--text-secondary)]">
                  {currentGradingStyle.description}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 shadow-lg">
              <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Isnad chain
              </h4>
              <ul className="mt-4 space-y-4">
                {currentHadith.chain.map((node, index) => {
                  const isProphet = node.type === "prophet";
                  const isExpanded = expandedNarrators.has(node.name);
                  const baseClasses = isProphet
                    ? "bg-gradient-to-r from-[#0b7a6c] to-[#1b4332] text-white border-transparent shadow-lg"
                    : isExpanded
                      ? "border-[var(--accent-emerald)] bg-[var(--background)]"
                      : "border-[var(--border-soft)] bg-[var(--background)]";
                  return (
                    <li key={node.name} className="relative pl-6">
                      {!isProphet && (
                        <span
                          className="absolute -left-2 top-[10%] h-[80%] w-px bg-[var(--border-soft)]"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isProphet) return;
                          handleToggleNarrator(node.name);
                        }}
                        className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${baseClasses}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:inherit]">
                              {!isProphet && (
                                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/15 text-[0.7rem] text-[var(--accent-emerald)]">
                                  {index + 1}
                                </span>
                              )}
                              {node.name}
                            </p>
                            <p className={`text-xs ${isProphet ? "text-white/80" : "text-[var(--text-muted)]"}`}>
                              {node.descriptor}
                            </p>
                          </div>
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
                        {!isProphet && isExpanded && node.bio && (
                          <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {node.bio}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
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
