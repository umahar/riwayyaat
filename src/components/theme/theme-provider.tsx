"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const THEME_STORAGE_KEY = "riwayyaat-theme";

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(value: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = value;
  root.style.setProperty("color-scheme", value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme =
      stored === "light" || stored === "dark" ? stored : getPreferredTheme();
    applyTheme(nextTheme);
    return nextTheme;
  });

  const setTheme = useCallback((value: Theme) => {
    setThemeState(value);
    localStorage.setItem(THEME_STORAGE_KEY, value);
    applyTheme(value);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      applyTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
