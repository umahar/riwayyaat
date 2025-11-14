export type ThemeColors = {
  background: string;
  backgroundAlt: string;
  surfacePanel: string;
  surfaceCard: string;
  surfaceInput: string;
  surfacePopover: string;
  workspaceCardBg: string;
  workspaceCardBorder: string;
  chipBg: string;
  chipBorder: string;
  borderSoft: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  accentPrimary: string;
  accentSecondary: string;
  accentContrast: string;
  ctaPrimaryBg: string;
  ctaPrimaryText: string;
  ctaPrimaryHover: string;
  ctaSecondaryBorder: string;
  ctaSecondaryHoverBorder: string;
  ctaSecondaryText: string;
  auroraTop: string;
  auroraBottom: string;
  auroraBlurOne: string;
  auroraBlurTwo: string;
  sheen: string;
  shadowPanel: string;
  inputBorder: string;
  inputBorderFocus: string;
  exampleText: string;
};

export type ThemeShadows = {
  panel: string;
  card: string;
  badge: string;
};

export type ThemeRadii = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  full: string;
};

export type ThemeSpacing = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type ThemeFonts = {
  sans: string;
  mono: string;
};

export type ThemeLetterSpacing = {
  tight: string;
  wide: string;
};

export type ThemeConfig = {
  colors: ThemeColors;
  fonts: ThemeFonts;
  letterSpacing: ThemeLetterSpacing;
  radii: ThemeRadii;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
};

export const lightTheme: ThemeConfig = {
  colors: {
    background: "#f4faf7",
    backgroundAlt: "#e7f4ff",
    surfacePanel: "rgba(255, 255, 255, 0.92)",
    surfaceCard: "rgba(15, 23, 42, 0.06)",
    surfaceInput: "rgba(255, 255, 255, 0.94)",
    surfacePopover: "rgba(255, 255, 255, 0.96)",
    workspaceCardBg: "#ffffff",
    workspaceCardBorder: "rgba(15, 23, 42, 0.08)",
    chipBg: "rgba(15, 23, 42, 0.05)",
    chipBorder: "rgba(15, 23, 42, 0.12)",
    borderSoft: "rgba(15, 23, 42, 0.12)",
    borderStrong: "rgba(15, 23, 42, 0.25)",
    textPrimary: "#0f172a",
    textSecondary: "rgba(15, 23, 42, 0.85)",
    textMuted: "rgba(15, 23, 42, 0.65)",
    textSubtle: "rgba(15, 23, 42, 0.5)",
    accentPrimary: "#10b981",
    accentSecondary: "#0ea5e9",
    accentContrast: "#f8fafc",
    ctaPrimaryBg: "#0f172a",
    ctaPrimaryText: "#f8fafc",
    ctaPrimaryHover: "#1d2841",
    ctaSecondaryBorder: "rgba(15, 23, 42, 0.2)",
    ctaSecondaryHoverBorder: "rgba(15, 23, 42, 0.45)",
    ctaSecondaryText: "rgba(15, 23, 42, 0.85)",
    auroraTop: "rgba(14, 165, 233, 0.35)",
    auroraBottom: "rgba(16, 185, 129, 0.45)",
    auroraBlurOne: "rgba(16, 185, 129, 0.35)",
    auroraBlurTwo: "rgba(14, 165, 233, 0.35)",
    sheen: "rgba(255, 255, 255, 0.6)",
    shadowPanel: "rgba(15, 23, 42, 0.25)",
    inputBorder: "rgba(15, 23, 42, 0.15)",
    inputBorderFocus: "rgba(15, 23, 42, 0.6)",
    exampleText: "rgba(15, 23, 42, 0.85)",
  },
  fonts: {
    sans: "var(--font-poppins), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "var(--font-poppins), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  letterSpacing: {
    tight: "-0.02em",
    wide: "0.2em",
  },
  radii: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "20px",
    xl: "32px",
    full: "9999px",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
  },
  shadows: {
    panel: "0 35px 90px -40px rgba(15, 23, 42, 0.25)",
    card: "0 20px 60px -25px rgba(15, 23, 42, 0.2)",
    badge: "0 10px 25px rgba(15, 23, 42, 0.1)",
  },
};

export const darkTheme: ThemeConfig = {
  colors: {
    background: "#030712",
    backgroundAlt: "#050f1f",
    surfacePanel: "rgba(5, 12, 28, 0.75)",
    surfaceCard: "rgba(255, 255, 255, 0.08)",
    surfaceInput: "rgba(0, 0, 0, 0.35)",
    surfacePopover: "rgba(3, 7, 18, 0.9)",
    workspaceCardBg: "rgba(255, 255, 255, 0.08)",
    workspaceCardBorder: "rgba(255, 255, 255, 0.18)",
    chipBg: "rgba(255, 255, 255, 0.08)",
    chipBorder: "rgba(255, 255, 255, 0.18)",
    borderSoft: "rgba(255, 255, 255, 0.18)",
    borderStrong: "rgba(255, 255, 255, 0.35)",
    textPrimary: "#f8fafc",
    textSecondary: "rgba(248, 250, 252, 0.82)",
    textMuted: "rgba(248, 250, 252, 0.65)",
    textSubtle: "rgba(248, 250, 252, 0.45)",
    accentPrimary: "#34d399",
    accentSecondary: "#0ea5e9",
    accentContrast: "#041b11",
    ctaPrimaryBg: "#f0fdf4",
    ctaPrimaryText: "#064e3b",
    ctaPrimaryHover: "#bbf7d0",
    ctaSecondaryBorder: "rgba(255, 255, 255, 0.35)",
    ctaSecondaryHoverBorder: "rgba(255, 255, 255, 0.9)",
    ctaSecondaryText: "rgba(255, 255, 255, 0.85)",
    auroraTop: "rgba(16, 185, 129, 0.35)",
    auroraBottom: "rgba(14, 116, 144, 0.45)",
    auroraBlurOne: "rgba(52, 211, 153, 0.85)",
    auroraBlurTwo: "rgba(14, 165, 233, 0.8)",
    sheen: "rgba(255, 255, 255, 0.08)",
    shadowPanel: "rgba(3, 7, 18, 0.8)",
    inputBorder: "rgba(255, 255, 255, 0.2)",
    inputBorderFocus: "rgba(255, 255, 255, 0.85)",
    exampleText: "rgba(248, 250, 252, 0.85)",
  },
  fonts: lightTheme.fonts,
  letterSpacing: lightTheme.letterSpacing,
  radii: lightTheme.radii,
  spacing: lightTheme.spacing,
  shadows: {
    panel: "0 35px 90px -40px rgba(3, 7, 18, 0.8)",
    card: "0 20px 60px -25px rgba(3, 7, 18, 0.7)",
    badge: "0 10px 25px rgba(3, 7, 18, 0.35)",
  },
};

type ThemeName = "light" | "dark";

const themes: Record<ThemeName, ThemeConfig> = {
  light: lightTheme,
  dark: darkTheme,
};

export function getTheme(name: ThemeName): ThemeConfig {
  return themes[name];
}
