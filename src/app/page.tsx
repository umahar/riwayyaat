"use client";

import { useEffect, useState } from "react";
import { SplashHero } from "@/components/sections/splash-hero";
import { ChatPanel } from "@/components/sections/chat-panel";

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="font-sans">
      {showSplash ? <SplashHero /> : <ChatPanel />}
    </main>
  );
}
