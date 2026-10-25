"use client";
import { useState } from "react";

export function ScoreBadge({ score, size = "sm" }) {
  const tier = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  return (
    <span className={`score-badge ${tier}`} style={size === "lg" ? { fontSize: "1rem", padding: "6px 14px" } : {}}>
      {score?.toFixed ? score.toFixed(1) : score}
    </span>
  );
}

export function TierBadge({ tier }) {
  const colors = { A: "success", B: "warning", C: "warning", "High risk": "danger" };
  return <span className={`chip ${colors[tier] || "neutral"}`}>{tier}</span>;
}

export function FactorBar({ factor, value, weight, contribution }) {
  const pct = Math.min(100, Math.round((value || 0) * 100));
  return (
    <div className="factor-row">
      <span className="factor-name" title={factor}>{factor?.replace(/_/g, " ")}</span>
      <div className="factor-bar-bg">
        <div
          className="factor-bar-fill"
          style={{ width: `${pct}%`, background: pct > 70 ? "var(--success)" : pct > 40 ? "var(--tertiary)" : "var(--secondary)" }}
        />
      </div>
      <span className="factor-score">{pct}</span>
    </div>
  );
}

export function FactorBreakdown({ factors = [] }) {
  return (
    <div>
      {factors.map((f) => (
        <FactorBar key={f.factor} {...f} />
      ))}
    </div>
  );
}

export function CitationChip({ citation }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span className="citation-chip" onClick={() => setOpen(!open)} title={citation.source}>
        [{citation.chunk_id}]
        {citation.unverified && <span style={{ color: "#f59e0b" }}>!</span>}
      </span>
      {open && (
        <div style={{
          background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8,
          padding: "10px 14px", marginTop: 8, fontSize: "0.76rem", color: "#1e3a8a"
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{citation.title || citation.source}</div>
          <p style={{ color: "#374151", lineHeight: 1.5 }}>{citation.snippet}</p>
          <div style={{ marginTop: 6, display: "flex", gap: 12, color: "#6b7280" }}>
            {citation.source_url && <a href={citation.source_url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>Source</a>}
            <span>Last verified: {citation.last_verified || "UNVERIFIED"}</span>
            {citation.unverified && <span style={{ color: "#f59e0b" }}>Not officially verified</span>}
          </div>
        </div>
      )}
    </>
  );
}

export function Citations({ citations = [] }) {
  if (!citations.length) return null;
  return (
    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
      {citations.map((c) => <CitationChip key={c.chunk_id} citation={c} />)}
    </div>
  );
}

export function LoadingState({ text = "Loading…" }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      <span>{text}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span style={{ fontSize: "1.2rem" }}>!</span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Something went wrong</div>
        <div style={{ fontSize: "0.78rem" }}>{message}</div>
        {onRetry && <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}

export function EmptyState({ title = "No data", description = "Nothing to show here yet." }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: "2.5rem", marginBottom: 12, opacity: 0.3 }}>•</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function Skeleton({ type = "text", count = 3 }) {
  const lines = Array.from({ length: count });
  if (type === "card") return <div className="skeleton skeleton-card" />;
  return (
    <div>
      <div className="skeleton skeleton-title" />
      {lines.map((_, i) => (
        <div key={i} className="skeleton skeleton-text" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  );
}

export function RiskFlag({ flag, level = "amber" }) {
  return (
    <div className={`risk-flag ${level}`}>
      <span>{level === "red" ? "R" : level === "amber" ? "A" : "G"}</span>
      <span>{flag}</span>
    </div>
  );
}
