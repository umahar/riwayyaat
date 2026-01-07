"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HadithInsight } from "@/features/hadith/types";
import { workspaceCopy } from "@/content/text";
import { HadithSidebar, FilterGroup } from "@/features/workspace/components/sidebar/hadith-sidebar";
import { ConversationPanel } from "@/features/workspace/components/chat/conversation-panel";
import { HadithDetailsPanel } from "@/features/workspace/components/details/hadith-details-panel";
import { useHadithData } from "@/features/workspace/hooks/use-hadith-data";
import { useRagChat } from "@/features/workspace/hooks/use-rag-chat";

type ChatWorkspaceProps = {
  initialPrompt: string;
  onNewChat: () => void;
};

export function ChatWorkspace({ initialPrompt, onNewChat }: ChatWorkspaceProps) {
  const { messages, isLoading, error, submitQuestion, resultHadithIds, lastHadithId, clearContext } =
    useRagChat();
  const [input, setInput] = useState("");
  const [selectedHadithId, setSelectedHadithId] = useState<string | null>(null);
  const [selectedGradings, setSelectedGradings] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [showAllHadiths, setShowAllHadiths] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const [isDesktop, setIsDesktop] = useState(false);

  const previousLeftWidth = useRef(leftWidth);
  const leftWidthInitialized = useRef(false);
  const rightWidthInitialized = useRef(false);
  const dragState = useRef<{
    panel: "left" | "right";
    startX: number;
    startWidth: number;
    min: number;
    max: number;
  } | null>(null);

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
    const contextId = selectedHadithId ?? lastHadithId;
    submitQuestion(trimmed, {
      limit: 6,
      filters: contextId ? { contextHadithId: Number(contextId) } : undefined,
    });
    setInput("");
  };

  // Auto-run initial prompt if provided
  const initialPromptRan = useRef(false);
  useEffect(() => {
    if (initialPromptRan.current) return;
    if (initialPrompt?.trim()) {
      initialPromptRan.current = true;
      submitQuestion(initialPrompt, { limit: 6 });
      setInput("");
    }
  }, [initialPrompt, submitQuestion]);

  const { data: hadithData, loading: hadithLoading, error: hadithError, refresh: refreshHadith } =
    useHadithData();

  const handleToggleShowAll = useCallback(() => {
    setShowAllHadiths((current) => {
      const next = !current;
      if (!current) {
        refreshHadith();
      }
      return next;
    });
  }, [refreshHadith]);

  const scopedHadithData = useMemo(() => {
    if (showAllHadiths || !resultHadithIds) return hadithData;
    const ids = new Set(resultHadithIds);
    return hadithData.filter((hadith) => ids.has(hadith.id));
  }, [hadithData, resultHadithIds, showAllHadiths]);

  const hadithMap = useMemo(() => {
    return scopedHadithData.reduce<Record<string, HadithInsight>>((acc, hadith) => {
      acc[hadith.id] = hadith;
      return acc;
    }, {});
  }, [scopedHadithData]);

  const gradingOptions = useMemo(
    () => Array.from(new Set(scopedHadithData.map((hadith) => hadith.details.grading))),
    [scopedHadithData],
  );

  const bookOptions = useMemo(
    () => Array.from(new Set(scopedHadithData.map((hadith) => hadith.details.book))),
    [scopedHadithData],
  );

  const sourceOptions = useMemo(
    () => Array.from(new Set(scopedHadithData.map((hadith) => hadith.details.source))),
    [scopedHadithData],
  );

  const toggleSetValue = useCallback(
    (
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
    },
    [],
  );

  const filterGroups = useMemo<FilterGroup[]>(
    () => [
      {
        key: "grading",
        label: workspaceCopy.sidebar.filters.grade.label,
        menuTitle: workspaceCopy.sidebar.filters.grade.title,
        options: gradingOptions,
        selected: selectedGradings,
        onToggle: (value: string) => toggleSetValue(value, setSelectedGradings),
        onClear: () => setSelectedGradings(new Set<string>()),
        clearLabel: workspaceCopy.sidebar.filters.grade.clear,
      },
      {
        key: "book",
        label: workspaceCopy.sidebar.filters.book.label,
        menuTitle: workspaceCopy.sidebar.filters.book.title,
        options: bookOptions,
        selected: selectedBooks,
        onToggle: (value: string) => toggleSetValue(value, setSelectedBooks),
        onClear: () => setSelectedBooks(new Set<string>()),
        clearLabel: workspaceCopy.sidebar.filters.book.clear,
      },
      {
        key: "source",
        label: workspaceCopy.sidebar.filters.source.label,
        menuTitle: workspaceCopy.sidebar.filters.source.title,
        options: sourceOptions,
        selected: selectedSources,
        onToggle: (value: string) => toggleSetValue(value, setSelectedSources),
        onClear: () => setSelectedSources(new Set<string>()),
        clearLabel: workspaceCopy.sidebar.filters.source.clear,
      },
    ],
    [gradingOptions, selectedGradings, bookOptions, selectedBooks, sourceOptions, selectedSources, toggleSetValue],
  );

  const filteredHadiths = useMemo(
    () =>
      scopedHadithData.filter((hadith) => {
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
    [scopedHadithData, selectedGradings, selectedBooks, selectedSources],
  );

  const visibleHadithIds = useMemo(
    () => new Set(filteredHadiths.map((hadith) => hadith.id)),
    [filteredHadiths],
  );

  useEffect(() => {
    if (selectedHadithId && !visibleHadithIds.has(selectedHadithId)) {
      setSelectedHadithId(null);
    }
  }, [selectedHadithId, visibleHadithIds]);

  const currentHadith = useMemo(() => {
    if (!selectedHadithId) {
      return null;
    }
    return hadithMap[selectedHadithId] ?? null;
  }, [hadithMap, selectedHadithId]);

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
      setLeftWidth(clamp(previousLeftWidth.current ?? LEFT_MIN, LEFT_MIN, LEFT_MAX));
    } else {
      previousLeftWidth.current = leftWidth;
      setLeftCollapsed(true);
      setLeftWidth(COLLAPSED_WIDTH);
    }
  };

  const handleSelectHadith = (id: string) => {
    setSelectedHadithId(id);
  };
  const handleCitationSelect = (id: string) => {
    setSelectedHadithId(id);
  };
  const handleClearContext = () => {
    setSelectedHadithId(null);
    clearContext();
  };

  const activeHadithId = currentHadith?.id ?? null;
  const contextHadithId = selectedHadithId ?? lastHadithId ?? null;
  const contextHadith = contextHadithId ? hadithMap[contextHadithId] : null;
  const contextLabel = contextHadith
    ? `${contextHadith.details.source} — ${contextHadith.details.displayNumber ?? contextHadith.id}`
    : contextHadithId
      ? `Hadith ID ${contextHadithId}`
      : null;

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
      <HadithSidebar
        collapsed={leftCollapsed}
        isDesktop={isDesktop}
        onToggleCollapse={handleToggleLeft}
        onResizeStart={isDesktop ? startResize("left") : undefined}
        onNewChat={onNewChat}
        showAllHadiths={showAllHadiths}
        onToggleShowAllHadiths={handleToggleShowAll}
        hadiths={filteredHadiths}
        activeHadithId={activeHadithId}
        onSelectHadith={handleSelectHadith}
        filterGroups={filterGroups}
        loading={hadithLoading || isLoading}
        error={hadithError}
        onRetry={refreshHadith}
      />

      <ConversationPanel
        messages={messages}
        loading={isLoading}
        error={error}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        onCitationSelect={handleCitationSelect}
        contextLabel={contextLabel}
        onClearContext={contextLabel ? handleClearContext : undefined}
      />

      <HadithDetailsPanel
        key={currentHadith?.id ?? "empty"}
        hadith={currentHadith}
        isDesktop={isDesktop}
        onResizeStart={startResize("right")}
        loading={hadithLoading}
        error={hadithError}
        onRetry={refreshHadith}
      />
    </section>
  );
}
