"use client";
import { useLang } from "@/lib/lang";
export default function Footer() {
  const { t } = useLang();
  return <footer className="ft"><span>{t("fT")}</span><span>DPIIT · NITI Aayog · RBI · CEA</span></footer>;
}
