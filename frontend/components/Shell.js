"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import CultureModal from "./CultureModal";

const NAV = [
  {
    section: "EXECUTIVE MODULES",
    items: [
      { href: "/", label: "journeyOverview", sub: "executiveCommand", icon: "" },
      { href: "/research", label: "research", sub: "researchSub", icon: "" },
      { href: "/match", label: "match", sub: "matchSub", icon: "" },
      { href: "/comply", label: "comply", sub: "complySub", icon: "" },
      { href: "/gtm", label: "launch", sub: "launchSub", icon: "" },
    ],
  },
  {
    section: "ADVISORY & INTELLIGENCE",
    items: [
      { href: "/culture", label: "culture", sub: "cultureSub", icon: "" },
      { href: "/onboard", label: "vault", sub: "vaultSub", icon: "" },
    ],
  },
];

const STAGES = [
  { href: "/research", label: "Research (Scoping)", num: "01" },
  { href: "/match", label: "Match (Partner DD)", num: "02" },
  { href: "/comply", label: "Comply (Regulatory)", num: "03" },
  { href: "/gtm", label: "Launch (Operations)", num: "04" },
];

export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, setSession, session } = useApp();
  const tr = useT(lang);
  const sess = session;
  const [showCulture, setShowCulture] = useState(false);

  const stageStatus = (href) => {
    const order = STAGES.map(s => s.href);
    const cur = order.indexOf(pathname);
    const idx = order.indexOf(href);
    if (pathname === href) return "active";
    if (cur > idx) return "done";
    return "";
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>KANKEI</h1>
          <p>Japan-India Bilateral Expansion Platform</p>
        </div>

        {NAV.map((section) => (
          <div className="sidebar-section" key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)) ? "active" : ""}`}
              >
                <span style={{ fontSize: "1rem", lineHeight: 1 }}>{item.icon}</span>
                <span>
                  {tr(item.label)}
                  <span className="nav-sub">{tr(item.sub)}</span>
                </span>
              </Link>
            ))}
          </div>
        ))}

        <div style={{ marginTop: "auto", padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
            Security Classification: HQ-RESTRICTED 機密
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", flexDirection: "column" }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8rem" }}>Active Expansion Project</span>
              <span>{sess?.profile?.company || "India Market Entry"}</span>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
              <div className="lang-toggle">
                <button className={`lang-btn ${lang === "ja" ? "active" : ""}`} onClick={() => setLang("ja")}>JA 日本語</button>
                <button className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>EN English</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700 }}>{(sess?.profile?.company || "C").charAt(0)}</div>
                <div style={{ fontSize: "0.76rem" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sess?.profile?.company || "Company Contact"}</div>
                  <div style={{ color: "var(--text-muted)" }}>{sess?.profile?.customer_type || "India Market Entry"}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Pipeline stage bar */}
        <div className="pipeline-bar">
          {STAGES.map((s) => {
            const status = stageStatus(s.href);
            return (
              <Link key={s.href} href={s.href} className={`pipeline-stage ${status}`}>
                <span className="stage-num">{status === "done" ? "" : s.num}</span>
                {s.label}
              </Link>
            );
          })}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 8px" }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCulture(true)}
            >
              Culture & Negotiation Copilot
            </button>
          </div>
        </div>

        {/* Page body */}
        <main className="page-body animate-fadeIn">
          {children}
        </main>
      </div>

      {/* Culture FAB */}
      <button className="culture-fab" onClick={() => setShowCulture(true)}>
        Culture Copilot
      </button>

      {showCulture && <CultureModal onClose={() => setShowCulture(false)} />}
    </div>
  );
}
