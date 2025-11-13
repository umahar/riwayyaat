"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/sections/chat-panel";
import { ChatWorkspace } from "@/components/workspace/chat-workspace";
import { ProjectFooter } from "@/components/footer/project-footer";

type Stage = "landing" | "workspace";

export default function Home() {
  const [stage, setStage] = useState<Stage>("landing");
  const [initialPrompt, setInitialPrompt] = useState("");

  const handlePromptSubmit = (prompt: string) => {
    setInitialPrompt(prompt);
    setStage("workspace");
  };

  const handleNewChat = () => {
    setInitialPrompt("");
    setStage("landing");
  };

  return (
    <main className="font-sans min-h-svh pb-12">
      {stage === "landing" && (
        <>
          <ChatPanel onSubmit={handlePromptSubmit} />
          <ProjectFooter />
        </>
      )}
      {stage === "workspace" && (
        <ChatWorkspace
          key={initialPrompt}
          initialPrompt={initialPrompt}
          onNewChat={handleNewChat}
        />
      )}
    </main>
  );
}
