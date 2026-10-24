"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { getHealth, createSession, patchSession, rankStates, rankPartners, getChecklist } from "@/lib/api";
import { ScoreBadge, LoadingState, ErrorState } from "@/components/UI";

export default function Home() {
  const { lang, session, setSession } = useApp();
  const tr = useT(lang);
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((e) => setHealthErr(e.message));
  }, []);

  const sess = session;
  const research = sess?.research;
  const match = sess?.match;
  const comply = sess?.comply;
  const gtm = sess?.gtm;

  const topState = Array.isArray(research) && research.length > 0 ? research[0] : null;
  const partnerCount = Array.isArray(match) ? match.length : 0;
  const complianceItems = Array.isArray(comply) ? comply.length : 0;
  const stages = sess?.stages;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "var(--primary)" }}>
              Journey Overview
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem" }}>
            Executive Command Center — {sess?.profile?.company || "India Market Entry"}
          </p>
        </div>
      </div>

      {/* Health indicator */}
      <div style={{ marginBottom: 20 }}>
        {healthErr ? (
          <div className="error-state" style={{ padding: "10px 16px" }}>
            ⚠ Backend unreachable: {healthErr} — running in mock mode
          </div>
        ) : health ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "var(--radius-sm)", padding: "10px 16px", fontSize: "0.78rem", color: "#065f46", display: "flex", alignItems: "center", gap: 8 }}>
            ✓ Backend online · {health.data?.states} states · {health.data?.partners} partners · {health.data?.hs_codes} HS codes
          </div>
        ) : (
          <div className="skeleton" style={{ height: 36, borderRadius: "var(--radius-sm)" }} />
        )}
      </div>

      {/* Company Profile */}
      {sess?.profile && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><div className="card-title">Company Profile</div><div className="card-label">Details captured during onboarding</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Company</div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sess.profile.company || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Headquarters</div>
              <div style={{ color: "var(--text-primary)" }}>{sess.profile.hq || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Product / Service</div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>{sess.profile.product || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Category</div>
              <div style={{ color: "var(--text-primary)" }}>{sess.profile.product_category?.replace(/_/g, " ") || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Business Model</div>
              <div style={{ color: "var(--text-primary)" }}>{sess.profile.customer_type || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Budget (JPY)</div>
              <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{sess.profile.budget_jpy ? `¥${Number(sess.profile.budget_jpy).toLocaleString()}` : "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Employees</div>
              <div style={{ color: "var(--text-primary)" }}>{sess.profile.employees || "—"}</div>
            </div>
            <div style={{ padding: "10px 12px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Entry Route</div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.82rem" }}>{sess.profile.route?.replace(/_/g, " ") || "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Progress snapshot */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><div className="card-title">Journey Progress</div><div className="card-label">Stages completed so far</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          {[
            { num: "01", label: "Research Hub", sub: "Market Data & State Ranking", href: "/research", color: "var(--primary)", done: !!topState },
            { num: "02", label: "Partner Matching", sub: "Shortlist & Due Diligence", href: "/match", color: "var(--secondary)", done: partnerCount > 0 },
            { num: "03", label: "Comply & GTM", sub: "Regulatory & Commercial Launch", href: "/comply", color: "var(--tertiary)", done: complianceItems > 0 },
            { num: "04", label: "Launch Playbook", sub: "Entity Setup & Operations", href: "/gtm", color: "var(--success)", done: !!gtm },
          ].map((stage) => (
            <Link key={stage.num} href={stage.href} style={{ textDecoration: "none" }}>
              <div style={{ padding: 16, borderRadius: "var(--radius)", border: `1px solid ${stage.done ? stage.color : "var(--border)"}`, background: stage.done ? `${stage.color}0d` : "var(--bg)", transition: "all 0.2s", cursor: "pointer" }} onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={(e) => e.currentTarget.style.transform = ""}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 28, height: 28, borderRadius: "50%", background: stage.done ? stage.color : "var(--border)", color: stage.done ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700 }}>{stage.done ? "✓" : stage.num}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: stage.done ? stage.color : "var(--text-secondary)" }}>{stage.done ? "Complete" : "Upcoming"}</span>
                </div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9rem", marginBottom: 4, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{stage.label}</div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{stage.sub}</div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {topState ? "✓ Top target state ranked" : "○ Run Research to rank target states"} &nbsp;·&nbsp;{partnerCount > 0 ? "✓ Partners matched" : "○ Run Partner Matching to shortlist partners"} &nbsp;·&nbsp;{complianceItems > 0 ? "✓ Compliance steps identified" : "○ Run Compliance to generate regulatory roadmap"} &nbsp;·&nbsp;{gtm ? "✓ GTM strategy ready" : "○ Run GTM to build price waterfall"}
        </div>
      </div>

      {/* Metric grid */}
      <div className="metric-grid" style={{ marginBottom: 28 }}>
        <div className="metric-card" style={{ borderTop: "3px solid var(--secondary)" }}>
          <div className="metric-label">📍 Target State</div>
          <div className="metric-value" style={{ fontSize: "1.4rem" }}>
            {topState ? topState.state : "—"}
          </div>
          <div className="metric-sub">
            {topState ? (
              <>Score: <ScoreBadge score={topState.score} /> · Rank #{topState.rank}</>
            ) : "Run Research phase to rank states"}
          </div>
        </div>

        <div className="metric-card" style={{ borderTop: "3px solid var(--primary)" }}>
          <div className="metric-label">🤝 Partner Pipeline</div>
          <div className="metric-value">{partnerCount || "—"}</div>
          <div className="metric-sub">
            {partnerCount ? `${partnerCount} vetted partners matched` : "Run Partner Matching phase"}
          </div>
        </div>

        <div className="metric-card" style={{ borderTop: "3px solid var(--tertiary)" }}>
          <div className="metric-label">✅ Compliance Items</div>
          <div className="metric-value">{complianceItems || "—"}</div>
          <div className="metric-sub">
            {complianceItems ? `${complianceItems} regulatory steps identified` : "Run Compliance phase"}
          </div>
        </div>

        <div className="metric-card" style={{ borderTop: "3px solid var(--success)" }}>
          <div className="metric-label">🚀 GTM Strategy</div>
          <div className="metric-value" style={{ fontSize: "1.1rem" }}>
            {gtm?.recommendation?.results?.[0]?.model?.replace(/_/g, " ") || "—"}
          </div>
          <div className="metric-sub">
            {gtm ? "Top GTM model recommended" : "Run GTM phase"}
          </div>
        </div>
      </div>

    </div>
  );
}
