"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { coachMessage, checkPhrase } from "@/lib/api";
import {
  LoadingState, ErrorState, EmptyState, RiskFlag
} from "@/components/UI";

export default function CulturePage() {
  const { lang, session } = useApp();
  const tr = useT(lang);
  const [tab, setTab] = useState("coach");
  const [message, setMessage] = useState("");
  const [direction, setDirection] = useState("ja_to_in");
  const [context, setContext] = useState("");
  const [coachResult, setCoachResult] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState(null);

  // Phrase check state
  const [phraseText, setPhraseText] = useState("");
  const [phraseResult, setPhraseResult] = useState(null);
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [phraseError, setPhraseError] = useState(null);

  const handleCoach = async () => {
    if (!message.trim()) return;
    setCoachLoading(true); setCoachError(null); setCoachResult(null);
    try {
      const r = await coachMessage({ message, direction, context: context || undefined, language: lang });
      setCoachResult(r);
    } catch (e) {
      setCoachError(e.message);
    } finally {
      setCoachLoading(false);
    }
  };

  const handlePhraseCheck = async () => {
    if (!phraseText.trim()) return;
    setPhraseLoading(true); setPhraseError(null); setPhraseResult(null);
    try {
      const r = await checkPhrase(phraseText);
      setPhraseResult(r);
    } catch (e) {
      setPhraseError(e.message);
    } finally {
      setPhraseLoading(false);
    }
  };

  const SAMPLE_MESSAGES = [
    { label: "Japanese ambiguity", text: "前向きに検討します。", direction: "ja_to_in" },
    { label: "Indian commitment", text: "Yes, no problem, it will be done.", direction: "in_to_ja" },
    { label: "Nemawashi", text: "We will need to consult with our team and circle back.", direction: "in_to_ja" },
    { label: "Japanese refusal", text: "It is a bit difficult at this stage.", direction: "ja_to_in" },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ fontSize: "1.3rem" }}>Cultural Intelligence</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: 4 }}>
            Bi-directional Japan-India communication intelligence & negotiation guidance
          </p>
        </div>
      </div>

      {/* Quick explanation card */}
      <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)", color: "#fff", border: "none" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <span style={{ fontSize: "2rem" }}>•</span>
          <div>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1rem", fontWeight: 700, marginBottom: 6 }}>
              Culture & Negotiation Copilot
            </h2>
            <p style={{ fontSize: "0.82rem", opacity: 0.85, lineHeight: 1.6 }}>
              Japanese and Indian business communication styles differ fundamentally. "前向きに検討します" is often a polite refusal, 
              while "no problem" from an Indian counterpart may mean the issue was acknowledged, not resolved. 
              This copilot helps decode these nuances in real-time.
            </p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "coach" ? "active" : ""}`} onClick={() => setTab("coach")}>Message Coach</button>
        <button className={`tab ${tab === "phrase" ? "active" : ""}`} onClick={() => setTab("phrase")}>Phrase Check</button>
      </div>

      {/* ── Message Coach ── */}
      {tab === "coach" && (
        <div className="animate-fadeIn">
          <div className="grid-2" style={{ alignItems: "flex-start", gap: 20 }}>
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Analyze Message</div>
                <div className="form-group">
                  <label className="form-label">Direction</label>
                  <select className="form-input form-select" value={direction} onChange={e => setDirection(e.target.value)}>
                    <option value="ja_to_in">Japanese to Indian</option>
                    <option value="in_to_ja">Indian to Japanese</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea className="form-input" rows={5} value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Paste your business message here…" style={{ resize: "vertical" }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Context (optional)</label>
                  <input className="form-input" value={context} onChange={e => setContext(e.target.value)}
                    placeholder="e.g. Price negotiation with Gujarat distributor" />
                </div>
                <button className="btn btn-primary w-full" onClick={handleCoach} disabled={coachLoading || !message.trim()}>
                  {coachLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : ""} Analyze Communication
                </button>
              </div>

              {/* Sample messages */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Sample Messages</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SAMPLE_MESSAGES.map((s, i) => (
                    <button key={i} className="btn btn-outline btn-sm"
                      style={{ textAlign: "left", justifyContent: "flex-start" }}
                      onClick={() => { setMessage(s.text); setDirection(s.direction); }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginRight: 4 }}>[{s.label}]</span>
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results */}
            <div>
              {coachLoading && <div className="card"><LoadingState text="Analyzing cultural context…" /></div>}
              {coachError && <ErrorState message={coachError} />}
              {coachResult && (
                <div className="animate-fadeIn">
                  {/* Phrase hits */}
                  {coachResult.phrase_hits?.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-title" style={{ marginBottom: 12 }}>Cultural Phrase Flags</div>
                      {coachResult.phrase_hits.map((hit, i) => (
                        <div key={i} style={{ padding: "10px 0", borderBottom: i < coachResult.phrase_hits.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span className="chip warning">"{hit.matched}"</span>
                            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{hit.speaker} speaker</span>
                          </div>
                          <div style={{ fontSize: "0.78rem", marginBottom: 2 }}>
                            <strong style={{ color: "var(--text-primary)" }}>Actual: </strong>
                            <span style={{ color: "var(--text-secondary)" }}>{hit.actual_meaning}</span>
                          </div>
                          <div style={{ fontSize: "0.78rem", color: "#dc2626" }}>
                            <strong>Perceived: </strong>{hit.perceived_by_listener}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risks */}
                  {coachResult.risks?.length > 0 && (
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div className="card-title" style={{ marginBottom: 12 }}>Communication Risks</div>
                      {coachResult.risks.map((r, i) => (
                        <RiskFlag key={i} flag={`[${r.dimension}] ${r.issue} — ${r.why}`} level="amber" />
                      ))}
                    </div>
                  )}

                  {/* Rewritten message */}
                  {coachResult.rewritten_message && (
                    <div className="card" style={{ marginBottom: 16, background: "#f0fdf4", borderColor: "#86efac" }}>
                      <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: 8, fontSize: "0.84rem" }}>Suggested Rewrite</div>
                      <p style={{ fontSize: "0.86rem", color: "#065f46", lineHeight: 1.7, fontStyle: "italic" }}>
                        "{coachResult.rewritten_message}"
                      </p>
                    </div>
                  )}

                  {/* Delivery tips */}
                  {coachResult.delivery_tips?.length > 0 && (
                    <div className="card">
                      <div className="card-title" style={{ marginBottom: 10 }}>Delivery Tips</div>
                      <ul style={{ paddingLeft: 16, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                        {coachResult.delivery_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!coachResult && !coachLoading && !coachError && (
                <div className="card">
                  <EmptyState title="No analysis yet" description="Enter a message and click 'Analyze Communication' to get cultural intelligence feedback." />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Phrase Check ── */}
      {tab === "phrase" && (
        <div className="animate-fadeIn">
          <div className="card" style={{ maxWidth: 640 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Deterministic Phrase Flagging</div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6 }}>
              Instantly flags known culturally ambiguous phrases from the Kankei playbook — no LLM required.
            </p>
            <div className="form-group">
              <textarea className="form-input" rows={4} value={phraseText} onChange={e => setPhraseText(e.target.value)}
                placeholder="Enter text to check for cultural phrases…" style={{ resize: "none" }} />
            </div>
            <button className="btn btn-primary" onClick={handlePhraseCheck} disabled={phraseLoading || !phraseText.trim()}>
              {phraseLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : ""} Check Phrases
            </button>
          </div>

          {phraseError && <div style={{ marginTop: 16 }}><ErrorState message={phraseError} /></div>}

          {phraseResult !== null && (
            <div style={{ marginTop: 16 }} className="animate-fadeIn">
              {phraseResult.length === 0 ? (
                <div className="card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontWeight: 600 }}>
                    No culturally ambiguous phrases detected.
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="card-title" style={{ marginBottom: 12 }}>Detected Phrases ({phraseResult.length})</div>
                  {phraseResult.map((hit, i) => (
                    <div key={i} style={{ padding: "12px 0", borderBottom: i < phraseResult.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        <span className="chip danger">"{hit.matched}"</span>
                        <span className="chip">{hit.speaker} speaker</span>
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        <strong>Actual meaning:</strong> {hit.actual_meaning}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "#dc2626", marginTop: 2 }}>
                        <strong>Perceived by listener:</strong> {hit.perceived_by_listener}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
