export const layoutCopy = {
  metadata: {
    defaultTitle: "Riwayyaat",
    titleTemplate: "%s • Riwayyaat",
    description:
      "Riwayyaat is a graph-native workspace for tracing hadith narrations, sanad integrity, and matn insights — a project by UA.",
  },
};

export const contactCopy = {
  projectLabel: "Masters Research Project",
  student: {
    name: "Umair Abdullah",
    id: "B01007607",
    emailLabel: "Abdullah-U@ulster.ac.uk",
  },
  supervisorLabel: "Supervised by",
  supervisorName: "Dr. Marwan M Radwan",
  supervisorOrg: "School of Computing, Ulster University",
};

export const footerCopy = {
  projectLabel: contactCopy.projectLabel,
  studentLine: `${contactCopy.student.name} • ${contactCopy.student.id} • ${contactCopy.student.emailLabel}`,
  supervisorLabel: contactCopy.supervisorLabel,
  supervisorName: contactCopy.supervisorName,
};

export const themeCopy = {
  toggle: {
    labelPrefix: "Switch to",
    labelSuffix: "mode",
  },
};

export const chatPanelCopy = {
  title: "Ask any question about a hadith, its matn, or sanad.",
  description:
    "Describe a narration, compare transmissions, probe narrator reliability, or surface commentaries—all from one canvas.",
  inputLabel: "Ask about any hadith",
  placeholder: "Ask anything about any hadith, its matn, or sanad...",
  buttonLabel: "Ask",
  tryHeading: "Try asking",
  promptIcon: "✦",
};

export const heroCopy = {
  contactCardLabel: contactCopy.projectLabel,
  contactStudentName: contactCopy.student.name,
  contactStudentId: contactCopy.student.id,
  contactEmailLabel: contactCopy.student.emailLabel,
  supervisorCardLabel: contactCopy.supervisorLabel,
  supervisorName: contactCopy.supervisorName,
  supervisorOrg: contactCopy.supervisorOrg,
};

export const workspaceCopy = {
  safety: {
    disclaimer:
      "This workspace is for study and exploration only. It uses the hadith available in this database and may be incomplete. It does not issue fatwas or rulings—please consult qualified scholars for religious guidance. AI answers can be wrong; always verify.",
  },
  system: {
    placeholderResponse:
      "Here is a synthesized response referencing the narrations and highlighting sanad integrity. (Placeholder response until backend is wired.)",
  },
  sidebar: {
    heading: "Hadiths",
    resultsSuffix: "results",
    newChatLabel: "Start a new chat",
    collapseLabel: "Collapse sidebar",
    expandLabel: "Expand sidebar",
    filters: {
      grade: { label: "Grade", title: "Select grade", clear: "Clear" },
      book: { label: "Book", title: "Select book", clear: "Clear" },
      source: { label: "Source", title: "Select source", clear: "Clear" },
    },
    loadingMessage: "Loading hadith data…",
    errorMessage: "Unable to load hadiths.",
    retryLabel: "Retry",
    emptyState: "No hadith match the selected filters.",
  },
  conversation: {
    title: "Conversation",
    description: "System streams insights, sanad graphs, and commentary context in real time.",
    inputLabel: "Continue the conversation",
    placeholder: "Ask about narrators, sanad overlaps, or commentary...",
    sendLabel: "Send",
    userLabel: "You",
    assistantLabel: "Riwayyaat Copilot",
  },
  details: {
    selectPrompt: "Select a hadith to view isnad",
    narrationHeading: "Narration Level",
    attributionHeading: "Attribution Type",
    chainHeading: "Chain Type",
    notClassified: "Not classified",
    fallbackTitle: "Not specified",
    fallbackDescription: "No classification provided.",
    authorFallback: "Author not specified",
    bookLabel: "Book",
    hadithLabel: "Hadith",
    gradedByLabel: "Graded by",
    gradedByFallback: "No scholar attribution provided",
  },
  narratorChain: {
    sectionTitle: "Isnad chain",
    countSuffix: "narrators",
    generationalRank: "Generational Rank",
    reliabilityRank: "Reliability Rank",
    transmissionMethod: "Transmission Method",
    roleFallback: "Narration role pending further classification.",
  },
};
