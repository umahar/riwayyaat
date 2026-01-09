export const siteConfig = {
  name: "Riwayyaat",
  shortName: "RY",
  byline: "A project by UA",
  description:
    "Riwayyaat is a living research surface for narrations, isnad graphs, and commentary layers.",
  tagline: "Graph-powered hadith exploration for researchers and students.",
  heroHeadline:
    "Mapping narrations, matn variations, and narrator networks in one living graph.",
  heroSubcopy:
    "Trace sanad integrity, compare matn wording, and surface commentary insights in seconds.",
  logoPath: "/logo.svg",
  logoAlt: "HadithGraph logo",
  primaryCta: {
    label: "Jump into the copilot",
    href: "#copilot",
  },
  secondaryCta: {
    label: "See how it works",
    href: "#copilot",
  },
  stats: [
    { label: "Narrations indexed", value: "180K+" },
    { label: "Narrators profiled", value: "52K+" },
    { label: "Research partners", value: "40+" },
  ],
  examplePrompts: [
    "Show Sahih al-Bukhari Hadith 1 with its full isnad and matn.",
    "Compare Sahih al-Bukhari 136 and Sahih al-Bukhari 203.",
    "Explain the hadith where knowledge is taken away, and show its chain.",
    "Summarize commentaries on the hadith about mercy between spouses.",
    "Show all unique transmission paths for the hadith about ablution invalidation.",
  ],
};

export type SiteConfig = typeof siteConfig;
