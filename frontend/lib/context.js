"use client";
import { createContext, useContext, useState } from "react";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState("en");
  const [session, setSession] = useState(null);
  const [demoLoaded, setDemoLoaded] = useState(false);

  return (
    <AppCtx.Provider value={{ lang, setLang, session, setSession, demoLoaded, setDemoLoaded }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
