"use client";
import { createContext, useContext, useState } from "react";

const AppCtx = createContext(null);

export function AppProvider({ children }) {
  const [lang, setLang] = useState("en");
  const [session, setSession] = useState(null);

  return (
    <AppCtx.Provider value={{ lang, setLang, session, setSession }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}
