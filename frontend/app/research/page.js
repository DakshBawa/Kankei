"use client";
import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { rankStates, getMarketBrief, askResearch, patchSession } from "@/lib/api";
import {
  ScoreBadge, FactorBreakdown, Citations,
  LoadingState, ErrorState, EmptyState, RiskFlag, Skeleton
} from "@/components/UI";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const DEFAULT_PROFILE = {
  product_category: "industrial_sensors",
  business_model: "B2B",
  budget_usd: 33333,
  priority_weights: {},
};

const FACTORS = ["demand","cluster","japan_presence","logistics","incentives","cost","talent","ease_of_business","power"];
const FACTOR_LABELS = {
  demand: "Market Demand", cluster: "Industrial Cluster", japan_presence: "Japan Presence",
  logistics: "Logistics", incentives: "Govt. Incentives", cost: "Cost Base",
  talent: "Talent Pool", ease_of_business: "Ease of Business", power: "Power Infrastructure",
};

export default function ResearchPage() {
  const { lang, session, setSession } = useApp();
  const tr = useT(lang);
  const sessionProfile = session?.profile;
  const [profile, setProfile] = useState(sessionProfile ? {
    product_category: sessionProfile.product_category || "industrial_sensors",
    business_model: sessionProfile.customer_type || "B2B",
    budget_usd: (sessionProfile.budget_jpy ? parseFloat(sessionProfile.budget_jpy) / 150 : 33333),
    product_description: sessionProfile.product || "",
    target_states: [],
    priority_weights: {},
  } : {
    product_category: "industrial_sensors",
    business_model: "B2B",
    budget_usd: 33333,
    product_description: "",
    target_states: [],
    priority_weights: {},
  });
  const [weights, setWeights] = useState({});
  const [states, setStates] = useState([]);
  const [weightsUsed, setWeightsUsed] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [tab, setTab] = useState("ranking");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [askLoading, setAskLoading] = useState(false);
  const [showWeights, setShowWeights] = useState(false);

  // Re-derive profile when session changes (e.g. after onboarding)
  useEffect(() => {
    if (sessionProfile) {
      setProfile({
        product_category: sessionProfile.product_category || "industrial_sensors",
        business_model: sessionProfile.customer_type || "B2B",
        budget_usd: (sessionProfile.budget_jpy ? parseFloat(sessionProfile.budget_jpy) / 150 : 33333),
        product_description: sessionProfile.product || "",
        target_states: [],
        priority_weights: {},
      });
    }
  }, [sessionProfile]);

  const fetchRanking = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const prio = {};
      Object.entries(weights).forEach(([k, v]) => { if (v !== 0) prio[k] = parseFloat(v); });
      const data = await rankStates({ ...profile, priority_weights: prio });
      setStates(data.results || []);
      setWeightsUsed(data.weights_used || {});
      setSession({ ...session, research: data.results || [] });
      try { await patchSession(session.session_id, { research: data.results || [] }); } catch {}
      if (!selectedState && data.results?.length) {
        setSelectedState(data.results[0].state);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile, weights]);

  useEffect(() => {
    // If session has research data, use it; else fetch
    if (session?.research && Array.isArray(session.research)) {
      setStates(session.research);
      if (!selectedState && session.research.length) setSelectedState(session.research[0].state);
    } else {
      fetchRanking();
    }
  }, [session, fetchRanking]);

  const fetchBrief = async (stateName) => {
    setBriefLoading(true); setBrief(null);
    try {
      const b = await getMarketBrief(profile, stateName);
      setBrief(b);
    } catch (e) {
      // ignore
    } finally {
      setBriefLoading(false);
    }
  };

  const handleStateSelect = (s) => {
    setSelectedState(s.state);
    if (tab === "brief") fetchBrief(s.state);
  };

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "brief" && selectedState && !brief) {
      fetchBrief(selectedState);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAskLoading(true); setAnswer(null);
    try {
      const r = await askResearch(question, selectedState, lang);
      setAnswer(r);
    } catch (e) {
      setAnswer({ answer: `Error: ${e.message}`, grounded: false, citations: [] });
    } finally {
      setAskLoading(false);
    }
  };

  const selected = states.find(s => s.state === selectedState);
  const chartData = states.slice(0, 10).map(s => ({ name: s.state.replace(" ", "\n"), score: parseFloat(s.score.toFixed(1)), rank: s.rank }));

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ fontSize: "1.3rem" }}>Market Research Hub</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowWeights(!showWeights)}>
            ⚖ {tr("weightSliders")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={fetchRanking} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : ""} Re-rank
          </button>
        </div>
      </div>

      {/* Profile + Weight config */}
      {showWeights && (
        <div className="card animate-fadeIn" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>Company Profile & Weights</div>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label">Product Category</label>
              <select className="form-input form-select" value={profile.product_category}
                onChange={e => setProfile(p => ({ ...p, product_category: e.target.value }))}>
                <option value="industrial_sensors">Industrial Sensors</option>
                <option value="auto_components">Auto Components</option>
                <option value="consumer_goods">Consumer Goods</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Business Model</label>
              <select className="form-input form-select" value={profile.business_model}
                onChange={e => setProfile(p => ({ ...p, business_model: e.target.value }))}>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Budget (USD)</label>
              <input className="form-input" type="number" value={profile.budget_usd}
                onChange={e => setProfile(p => ({ ...p, budget_usd: parseFloat(e.target.value) || 10000 }))} />
            </div>
          </div>
          <div className="card-title" style={{ marginBottom: 12, fontSize: "0.8rem" }}>Priority Weights (override defaults)</div>
          <div className="grid-3">
            {FACTORS.map(f => (
              <div key={f} className="form-group">
                <label className="form-label">{FACTOR_LABELS[f] || f}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={0} max={10} step={0.5}
                    value={weights[f] ?? weightsUsed[f] ?? 5}
                    onChange={e => setWeights(w => ({ ...w, [f]: parseFloat(e.target.value) }))}
                    style={{ flex: 1 }} />
                  <span className="font-mono" style={{ fontSize: "0.76rem", width: 24 }}>
                    {(weights[f] ?? weightsUsed[f] ?? 5).toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={fetchRanking} disabled={loading} style={{ marginTop: 8 }}>
            Submit to Backend for Re-ranking
          </button>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchRanking} />}

      <div className="grid-2" style={{ gap: 20, alignItems: "flex-start" }}>
        {/* Left: state list */}
        <div>
          {loading ? (
            <div className="card"><Skeleton count={8} /></div>
          ) : states.length === 0 ? (
            <EmptyState title="No states ranked" description="Click Re-rank to load state rankings from the backend." />
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="card-title">State Rankings</div>
                <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{states.length} states ranked</span>
              </div>
              <div style={{ maxHeight: 480, overflowY: "auto" }}>
                {states.map((s) => (
                  <div
                    key={s.state}
                    onClick={() => handleStateSelect(s)}
                    style={{
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      background: selectedState === s.state ? "rgba(217,56,30,0.05)" : "transparent",
                      borderLeft: selectedState === s.state ? "3px solid var(--secondary)" : "3px solid transparent",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { if (selectedState !== s.state) e.currentTarget.style.background = "var(--bg)"; }}
                    onMouseLeave={(e) => { if (selectedState !== s.state) e.currentTarget.style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 24, height: 24, borderRadius: "50%",
                          background: s.rank <= 3 ? "var(--secondary)" : "var(--bg)",
                          color: s.rank <= 3 ? "#fff" : "var(--text-muted)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
                          border: "1px solid var(--border)",
                        }}>
                          {s.rank}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.86rem", color: "var(--text-primary)" }}>{s.state}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {s.top_factors?.slice(0, 2).map(f => FACTOR_LABELS[f.factor] || f.factor).join(" · ")}
                          </div>
                        </div>
                      </div>
                      <ScoreBadge score={s.score} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div>
          {selected ? (
            <>
              <div className="tabs">
                {["ranking", "brief", "ask"].map(t => (
                  <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => handleTabChange(t)}>
                    {t === "ranking" ? "Factor Breakdown" : t === "brief" ? "Market Brief" : "Ask AI"}
                  </button>
                ))}
              </div>

              {tab === "ranking" && (
                <div className="animate-fadeIn">
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.2rem", fontWeight: 800 }}>{selected.state}</h2>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                          Rank #{selected.rank} · Last verified: {selected.last_verified || "N/A"}
                        </div>
                      </div>
                      <ScoreBadge score={selected.score} size="lg" />
                    </div>

                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Why This State?
                    </div>
                    {selected.top_factors?.map(f => (
                      <RiskFlag key={f.factor} flag={`${FACTOR_LABELS[f.factor] || f.factor}: score ${(f.value * 100).toFixed(0)}/100, contributes ${f.contribution.toFixed(1)} pts`} level="green" />
                    ))}

                    <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", margin: "16px 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      All Factors
                    </div>
                    <FactorBreakdown factors={selected.factors || []} />

                    {selected.data_sources && (
                      <div style={{ marginTop: 12, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                        📄 {selected.data_sources}
                      </div>
                    )}
                  </div>

                  {/* Bar chart */}
                  {chartData.length > 0 && (
                    <div className="card">
                      <div className="card-title" style={{ marginBottom: 16 }}>Score Comparison (Top 10)</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
                          <Tooltip formatter={(v) => [v.toFixed(1), "Score"]} />
                          <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.name.startsWith(selectedState?.substring(0, 5)) ? "var(--secondary)" : "var(--primary)"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {tab === "brief" && (
                <div className="animate-fadeIn">
                  {briefLoading ? (
                    <div className="card"><LoadingState text="Generating market brief…" /></div>
                  ) : brief ? (
                    <div className="card">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.1rem", fontWeight: 800 }}>{brief.state} — Market Brief</h2>
                        <ScoreBadge score={brief.score} />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>
                          {lang === "ja" ? "🇯🇵 日本語" : "🇬🇧 English"} Summary
                        </div>
                        <p style={{ fontSize: "0.84rem", color: "var(--text-primary)", lineHeight: 1.7 }}>
                          {lang === "ja" ? brief.ja?.market_summary : brief.en?.market_summary}
                        </p>
                      </div>
                      <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Target Customers</div>
                          {(lang === "ja" ? brief.ja?.target_customers : brief.en?.target_customers)?.map((c, i) => (
                            <div key={i} className="chip" style={{ marginBottom: 4, display: "block" }}>{c}</div>
                          ))}
                        </div>
                        <div>
                          <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase" }}>Key Risks</div>
                          {(lang === "ja" ? brief.ja?.risks : brief.en?.risks)?.map((r, i) => (
                            <RiskFlag key={i} flag={r} level="amber" />
                          ))}
                        </div>
                      </div>
                      <Citations citations={brief.citations || []} />
                    </div>
                  ) : (
                    <div className="card">
                      <EmptyState title="No brief yet" description="Click 'Market Brief' tab to generate an AI market summary." />
                    </div>
                  )}
                </div>
              )}

              {tab === "ask" && (
                <div className="animate-fadeIn">
                  <div className="card">
                    <div className="card-title" style={{ marginBottom: 12 }}>Ask AI about {selected.state}</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input
                        className="form-input"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAsk()}
                        placeholder="e.g. What is the industrial sensor demand in this state?"
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleAsk} disabled={askLoading || !question.trim()}>
                        {askLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Ask"}
                      </button>
                    </div>
                    {askLoading && <LoadingState text="Searching knowledge base…" />}
                    {answer && (
                      <div className="animate-fadeIn">
                        <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: "14px 16px", fontSize: "0.84rem", lineHeight: 1.7, color: "var(--text-primary)", marginBottom: 8 }}>
                          {answer.answer}
                        </div>
                        {!answer.grounded && (
                          <div style={{ fontSize: "0.74rem", color: "var(--tertiary)" }}>Answer not grounded in corpus — treat as general guidance.</div>
                        )}
                        <Citations citations={answer.citations || []} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <EmptyState title="Select a state" description="Click a state on the left to see its factor breakdown and market brief." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
