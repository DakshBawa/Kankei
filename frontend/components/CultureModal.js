"use client";
import { useState } from "react";
import { coachMessage, checkPhrase } from "@/lib/api";
import { useApp } from "@/lib/context";
import { LoadingState, ErrorState, RiskFlag, Citations } from "./UI";

export default function CultureModal({ onClose }) {
  const { lang } = useApp();
  const [tab, setTab] = useState("coach");
  const [message, setMessage] = useState("");
  const [direction, setDirection] = useState("ja_to_in");
  const [context, setContext] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCoach = async () => {
    if (!message.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await coachMessage({ message, direction, context: context || undefined, language: lang });
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhraseCheck = async () => {
    if (!message.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await checkPhrase(message);
      setResult({ phrase_hits: r });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Culture & Negotiation Copilot
            </h2>
            <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: 2 }}>
              Bi-directional Japan-India communication intelligence
            </p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>X</button>
        </div>
        <div className="drawer-body">
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab ${tab === "coach" ? "active" : ""}`} onClick={() => setTab("coach")}>Message Coach</button>
            <button className={`tab ${tab === "phrase" ? "active" : ""}`} onClick={() => setTab("phrase")}>Phrase Check</button>
          </div>

          {tab === "coach" && (
            <>
              <div className="form-group">
                <label className="form-label">Message to analyze</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Paste your business message here…"
                  style={{ resize: "vertical" }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Direction</label>
                <select className="form-input form-select" value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="ja_to_in">Japanese to Indian</option>
                  <option value="in_to_ja">Indian to Japanese</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Context (optional)</label>
                <input className="form-input" value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. Price negotiation with distributor in Gujarat" />
              </div>
              <button className="btn btn-primary w-full" onClick={handleCoach} disabled={loading || !message.trim()}>
                {loading ? <span className="spinner" /> : ""} Analyze Message
              </button>
            </>
          )}

          {tab === "phrase" && (
            <>
              <div className="form-group">
                <label className="form-label">Text to check for cultural phrases</label>
                <textarea
                  className="form-input"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a business phrase to check…"
                  style={{ resize: "vertical" }}
                />
              </div>
              <button className="btn btn-primary w-full" onClick={handlePhraseCheck} disabled={loading || !message.trim()}>
                {loading ? <span className="spinner" /> : ""} Check Phrases
              </button>
            </>
          )}

          {loading && <div style={{ marginTop: 16 }}><LoadingState text="Analyzing message…" /></div>}
          {error && <div style={{ marginTop: 16 }}><ErrorState message={error} /></div>}

          {result && (
            <div style={{ marginTop: 20 }} className="animate-fadeIn">
              {/* Phrase hits */}
              {result.phrase_hits?.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title" style={{ marginBottom: 12 }}>Phrase Flags</div>
                  {result.phrase_hits.map((hit, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span className="chip warning">"{hit.matched}"</span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{hit.speaker} speaker</span>
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                        <strong>Actual meaning:</strong> {hit.actual_meaning}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "#dc2626" }}>
                        <strong>Perceived by listener:</strong> {hit.perceived_by_listener}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Risks */}
              {result.risks?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Communication Risks</div>
                  {result.risks.map((r, i) => (
                    <RiskFlag key={i} flag={`[${r.dimension}] ${r.issue} — ${r.why}`} level="amber" />
                  ))}
                </div>
              )}

              {/* Rewritten message */}
              {result.rewritten_message && (
                <div className="card" style={{ marginBottom: 16, background: "#f0fdf4", borderColor: "#86efac" }}>
                  <div className="card-title" style={{ marginBottom: 8, color: "var(--success)" }}>Suggested Rewrite</div>
                  <p style={{ fontSize: "0.84rem", color: "#065f46", lineHeight: 1.6 }}>{result.rewritten_message}</p>
                </div>
              )}

              {/* Delivery tips */}
              {result.delivery_tips?.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 8 }}>Delivery Tips</div>
                  <ul style={{ paddingLeft: 16, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {result.delivery_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
