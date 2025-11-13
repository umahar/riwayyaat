"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    chapter: string;
    grading: string;
    location: string;
  };
  chain: Array<{
    name: string;
    descriptor: string;
    bio?: string;
  }>;
};

const hadithInsights: HadithInsight[] = [
  {
    id: "intention",
    matn:
      "Actions are judged by intentions, and every person will have what they intended...",
    sanad:
      "Narrated by Umar ibn al-Khattab, transmitted by Alqamah ibn Waqqas, narrated by Muhammad ibn Ibrahim al-Taymi...",
    details: {
      source: "Sahih al-Bukhari",
      book: "Book of Revelation",
      chapter: "How revelation began",
      grading: "Muttafaq 'alayh",
      location: "Hadith 1",
    },
    chain: [
      {
        name: "Imam al-Bukhari",
        descriptor: "Compiler",
        bio: "Muhammad ibn Isma'il al-Bukhari (d. 256 AH) compiled the most authentic Sunni collection.",
      },
      {
        name: "Yahya ibn Bukayr",
        descriptor: "Primary transmitter",
        bio: "Egyptian transmitter known for narrating from Layth ibn Sa'd with precision.",
      },
      {
        name: "Layth ibn Sa'd",
        descriptor: "Egyptian scholar",
        bio: "Prominent jurist of Egypt, contemporary of Imam Malik.",
      },
      {
        name: "Yazid ibn Abi Habib",
        descriptor: "Egyptian tabi'i",
        bio: "Egyptian Tabi'i famed for narrating from companions residing in Egypt.",
      },
      {
        name: "Muhammad ibn Ibrahim al-Taymi",
        descriptor: "Medinese scholar",
        bio: "Trustworthy Medinese narrator, part of the main chain for Hadith of Intentions.",
      },
      {
        name: "Alqamah ibn Waqqas",
        descriptor: "Companion student",
        bio: "Companion of the Companions, studied under Umar ibn al-Khattab.",
      },
      {
        name: "Umar ibn al-Khattab",
        descriptor: "Companion",
        bio: "Second Caliph, narrated several foundational hadith on governance and ethics.",
      },
    ],
  },
  {
    id: "jibril",
    matn:
      "Jibril came to the Prophet in the form of a man and asked about Islam, Iman, and Ihsan...",
    sanad:
      "Narrated by Abu Huraira, transmitted by Abu Salih, narrated by Al-A'raj...",
    details: {
      source: "Sahih Muslim",
      book: "Faith",
      chapter: "Clarifying Islam, Iman, and Ihsan",
      grading: "Sahih",
      location: "Hadith 8",
    },
    chain: [
      {
        name: "Imam Muslim",
        descriptor: "Compiler",
        bio: "Muslim ibn al-Hajjaj al-Naysaburi (d. 261 AH) preserved precise sanad variants.",
      },
      {
        name: "Yahya ibn Yahya",
        descriptor: "Primary transmitter",
        bio: "Andalusian scholar who relayed the collection to the west.",
      },
      {
        name: "Abu Khaythamah",
        descriptor: "Narrator",
        bio: "Zuhair ibn Harb, respected for narrations from Waki' ibn al-Jarrah.",
      },
      {
        name: "Waki' ibn al-Jarrah",
        descriptor: "Kufan Imam",
        bio: "Trustworthy Kufan hadith master and educator of Ahmad ibn Hanbal.",
      },
      {
        name: "Sufyan al-Thawri",
        descriptor: "Tabi al-Tabi'i",
        bio: "Founder of the Thawri school, famed for piety and critical isnad analysis.",
      },
      {
        name: "Abu Zinad",
        descriptor: "Medinese jurist",
        bio: "Abdullah ibn Dhakwan, linked to the Medinese legal tradition.",
      },
      {
        name: "Al-A'raj",
        descriptor: "Tabi'i",
        bio: "Abdur-Rahman ibn Hurmuz, a key transmitter from Abu Huraira.",
      },
      {
        name: "Abu Huraira",
        descriptor: "Companion",
        bio: "Narrated 5000+ hadith; guardian of the Prophet’s knowledge circle.",
      },
    ],
  },
  {
    id: "mercy",
    matn:
      "The Most Merciful has mercy on the merciful. Show mercy to those on the earth and the One above the heavens will show mercy to you. The Prophet repeated this exhortation while pointing to the bonds between believers, encouraging a softness that begins in the heart before it flows into deeds...",
    sanad:
      "Narrated by Abdullah ibn Amr, transmitted by Amr ibn Shu'ayb, narrated by his father Shu'ayb...",
    details: {
      source: "Sunan al-Tirmidhi",
      book: "Righteousness and Maintaining Ties",
      chapter: "Mercy towards creation",
      grading: "Hasan",
      location: "Hadith 1924",
    },
    chain: [
      { name: "Imam al-Tirmidhi", descriptor: "Compiler" },
      { name: "Qutaybah ibn Sa'id", descriptor: "Primary transmitter" },
      { name: "Layth ibn Sa'd", descriptor: "Egyptian Imam" },
      { name: "Abu Qilabah", descriptor: "Basran scholar" },
      { name: "Abdullah ibn Amr", descriptor: "Companion" },
    ],
  },
  {
    id: "light",
    matn:
      "Those who gather in one of the houses of Allah, reciting the Book of Allah and studying it together, tranquility descends upon them, mercy envelops them, the angels surround them, and Allah mentions them to those near Him. The Messenger emphasized the serenity that settles over circles of remembrance, explaining how their light stretches to the heavens even when the gathering is small and humble...",
    sanad:
      "Narrated by Abu Huraira, transmitted by Abu Salih, narrated by Al-A'raj, reported by Imam Muslim...",
    details: {
      source: "Sahih Muslim",
      book: "Remembrance",
      chapter: "Virtues of gatherings of dhikr",
      grading: "Sahih",
      location: "Hadith 2699",
    },
    chain: [
      { name: "Imam Muslim", descriptor: "Compiler" },
      { name: "Yahya ibn Yahya", descriptor: "Primary transmitter" },
      { name: "Abu Salih", descriptor: "Narrator" },
      { name: "Al-A'raj", descriptor: "Tabi'i" },
      { name: "Abu Huraira", descriptor: "Companion" },
    ],
  },
  {
    id: "trust",
    matn:
      "When trust is lost, await the Hour. The Prophet was asked how trust would be lost and he answered: when authority is given to those unworthy of it. He elaborated on how amanah is not merely a personal trait but the spine of communal integrity, and that societies crumble when posts become favors instead of responsibilities...",
    sanad:
      "Narrated by Abu Huraira, transmitted by Shu'ba, narrated by Qatada...",
    details: {
      source: "Sahih al-Bukhari",
      book: "Knowledge",
      chapter: "When authority is entrusted",
      grading: "Sahih",
      location: "Hadith 6496",
    },
    chain: [
      { name: "Imam al-Bukhari", descriptor: "Compiler" },
      { name: "Musaddad ibn Musarhad", descriptor: "Primary transmitter" },
      { name: "Abu 'Awanah", descriptor: "Narrator" },
      { name: "Qatada ibn Di'ama", descriptor: "Basran exegete" },
      { name: "Abu Huraira", descriptor: "Companion" },
    ],
  },
];

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
  const [hadithIndex, setHadithIndex] = useState(0);
  const [expandedNarrators, setExpandedNarrators] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [expandedMatnIds, setExpandedMatnIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const [isDesktop, setIsDesktop] = useState(false);

  const previousLeftWidth = useRef(leftWidth);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const setMatch = () => setIsDesktop(mediaQuery.matches);

    setMatch();
    mediaQuery.addEventListener("change", setMatch);

    return () => mediaQuery.removeEventListener("change", setMatch);
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

  const currentHadith = useMemo(
    () => hadithInsights[hadithIndex] ?? hadithInsights[0],
    [hadithIndex],
  );

  const handlePrevHadith = () =>
    setHadithIndex((index) =>
      index === 0 ? hadithInsights.length - 1 : index - 1,
    );
  const handleNextHadith = () =>
    setHadithIndex((index) =>
      index === hadithInsights.length - 1 ? 0 : index + 1,
    );

  const LEFT_MIN = 260;
  const LEFT_MAX = 420;
  const RIGHT_MIN = 360;
  const RIGHT_MAX = 520;
  const COLLAPSED_WIDTH = 72;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const effectiveLeftWidth = leftCollapsed ? COLLAPSED_WIDTH : leftWidth;
  const effectiveRightWidth = rightWidth;

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

  const handleCardClick = (index: number, id: string) => {
    setHadithIndex(index);
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


  return (
    <section
      className="grid min-h-svh w-full grid-cols-1 bg-[#eef2f7] transition-[grid-template-columns] duration-300 lg:grid-cols-[25%_40%_35%]"
      style={
        isDesktop
          ? {
              gridTemplateColumns: `${effectiveLeftWidth}px minmax(480px, 1fr) ${effectiveRightWidth}px`,
            }
          : undefined
      }
    >
      <aside className="relative flex max-h-svh flex-col gap-7 overflow-y-auto border-r border-[var(--border-soft)] bg-transparent px-6 py-8">
        <div className="flex items-center justify-between gap-3">
          {!leftCollapsed && (
            <div className="flex flex-1 items-center justify-between gap-2">
              <Logo className="scale-90 transform" />
              <ThemeToggle className="shrink-0" />
            </div>
          )}
          <button
            type="button"
            onClick={handleToggleLeft}
            className="rounded-full border border-slate-300 bg-white p-2 text-sm text-slate-600 shadow-sm"
            aria-label={leftCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {leftCollapsed ? "→" : "←"}
          </button>
        </div>
        {!leftCollapsed && (
          <>
            <button
              type="button"
              onClick={onNewChat}
              className="inline-flex items-center justify-center rounded-[1.75rem] bg-[var(--accent-emerald)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:opacity-90"
            >
              <span aria-hidden="true" className="mr-2">
                ✦
              </span>
              New chat
            </button>
            <header className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
                Hadiths
              </p>
              <p className="text-base font-semibold text-slate-900">
                {hadithInsights.length} entries
              </p>
            </header>
            <div className="space-y-6">
              {hadithInsights.map((hadith, index) => {
                const isActive = hadithIndex === index;
                const isExpanded = expandedMatnIds.has(hadith.id);
                const truncated =
                  hadith.matn.length > 220
                    ? `${hadith.matn.slice(0, 220)}…`
                    : hadith.matn;
                const matnPreview = isExpanded ? hadith.matn : truncated;
                return (
                  <article
                    key={hadith.id}
                    onClick={() => handleCardClick(index, hadith.id)}
                    className={`cursor-pointer rounded-3xl border bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      isActive
                        ? "border-emerald-300 shadow-lg ring-1 ring-emerald-200"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-400">
                          {hadith.details.location}
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {hadith.details.book}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {hadith.details.source}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-relaxed text-slate-600">
                        {matnPreview}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {hadith.details.grading}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {hadith.details.chapter}
                      </span>
                    </div>
                  </article>
                );
              })}
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
        <div className="flex-1 space-y-5 overflow-y-auto px-8 py-6">
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

      <aside className="relative flex max-h-svh flex-col overflow-y-auto bg-[var(--background-alt)] px-6 py-8">
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--text-muted)]">
              Hadith insights
            </p>
            <h3 className="text-lg font-bold tracking-[var(--tracking-tight)] text-[var(--text-primary)]">
              {currentHadith.details.source}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-3 py-1 text-xs">
              <button
                type="button"
                onClick={handlePrevHadith}
                aria-label="Previous hadith"
              >
                ←
              </button>
              <span>
                {hadithIndex + 1}/{hadithInsights.length}
              </span>
              <button
                type="button"
                onClick={handleNextHadith}
                aria-label="Next hadith"
              >
                →
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 space-y-6 overflow-y-auto pr-2">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-4 shadow-lg">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Isnad chain
            </h4>
            <ul className="mt-4 space-y-4">
              {currentHadith.chain.map((node, index) => {
                const isExpanded = expandedNarrators.has(node.name);
                return (
                  <li key={node.name} className="relative pl-6">
                    {index !== 0 && (
                      <span className="absolute -left-2 top-0 h-full w-px bg-[var(--border-soft)]" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleNarrator(node.name)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                        isExpanded
                          ? "border-[var(--accent-emerald)] bg-[var(--background)]"
                          : "border-[var(--border-soft)] bg-[var(--background)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            {node.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {node.descriptor}
                          </p>
                        </div>
                        <span className="text-lg">
                          {isExpanded ? "−" : "+"}
                        </span>
                      </div>
                      {isExpanded && (
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
