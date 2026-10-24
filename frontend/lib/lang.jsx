"use client";
import { createContext, useContext, useState } from "react";
import { DICT } from "./i18n";

const Ctx = createContext(null);
export function LangProvider({ children }) {
  const [lang, setLang] = useState("en");
  const t = (k) => DICT[lang][k] ?? k;
  const nm = (s) => (lang === "ja" ? s.nameJa : s.name);
  return <Ctx.Provider value={{ lang, setLang, t, nm }}>{children}</Ctx.Provider>;
}
export const useLang = () => useContext(Ctx);
