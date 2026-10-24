"use client";
import { useState } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { getPriceWaterfall, getModelRecommendation, patchSession } from "@/lib/api";
import {
  LoadingState, ErrorState, EmptyState, ScoreBadge, Skeleton
} from "@/components/UI";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ReferenceLine, CartesianGrid
} from "recharts";

const KIND_COLORS = {
  base: "var(--primary)",
  cost: "#64748b",
  duty: "var(--secondary)",
  margin: "var(--tertiary)",
  tax: "#8b5cf6",
  total: "var(--success)",
};

export default function GTMPage() {
  const { lang, session, setSession } = useApp();
  const tr = useT(lang);
  const [tab, setTab] = useState("waterfall");

  // Waterfall state
  const [wfReq, setWfReq] = useState({
    hs_code: "8543.70.90",
    unit_price: 5000,
    currency: "INR",
    fx_to_inr: null,
    freight_per_unit: 300,
    insurance_per_unit: 50,
    landing_charge_pct: 1.0,
    business_model: "B2B",
    competitor_price_inr: null,
  });
  const [wfResult, setWfResult] = useState(null);
  const [wfLoading, setWfLoading] = useState(false);
  const [wfError, setWfError] = useState(null);

  // Model recommendation state
  const [mrReq, setMrReq] = useState({
    profile: { product_category: "industrial_sensors", business_model: "B2B", budget_usd: 33333, priority_weights: {} },
    timeline_months: 12,
    risk_tolerance: "medium",
    control_need: "medium",
    local_manufacturing_required: false,
  });
  const [mrResult, setMrResult] = useState(null);
  const [mrLoading, setMrLoading] = useState(false);
  const [mrError, setMrError] = useState(null);

  const fetchWaterfall = async () => {
    setWfLoading(true); setWfError(null);
    try {
      const req = { ...wfReq };
      if (req.currency === "INR") delete req.fx_to_inr;
      if (req.currency !== "INR" && !req.fx_to_inr) {
        setWfError(`FX rate (INR per 1 ${req.currency}) is required.`);
        return;
      }
      if (!req.competitor_price_inr) delete req.competitor_price_inr;
      const data = await getPriceWaterfall(req);
      setWfResult(data);
    } catch (e) {
      setWfError(e.message);
    } finally {
      setWfLoading(false);
    }
  };

  const fetchModelRec = async () => {
    setMrLoading(true); setMrError(null);
    try {
      const data = await getModelRecommendation(mrReq);
      setMrResult(data);
      setSession({ ...session, gtm: data });
      try { await patchSession(session.session_id, { gtm: data }); } catch {}
    } catch (e) {
      setMrError(e.message);
    } finally {
      setMrLoading(false);
    }
  };

  const fmt = (n) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—");
  const fmtPct = (n) => (typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(1)}%` : "—");

  const chartData = wfResult?.steps?.map(s => ({
    label: s.label,
    value: Math.abs(s.delta_inr),
    delta: s.delta_inr,
    cumulative: s.cumulative_inr,
    kind: s.kind,
  })) || [];

  return (
    <div className="animate-fadeIn">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ fontSize: "1.3rem" }}>🚀 Go-to-Market</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: 4 }}>
            Price waterfall, GTM model comparison, and market entry strategy
          </p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "waterfall" ? "active" : ""}`} onClick={() => setTab("waterfall")}>💧 Price Waterfall</button>
        <button className={`tab ${tab === "model" ? "active" : ""}`} onClick={() => setTab("model")}>🗺 GTM Model</button>
      </div>

      {/* ── Price Waterfall ── */}
      {tab === "waterfall" && (
        <div className="animate-fadeIn">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Configure Pricing</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">HS Code *</label>
                <input className="form-input" value={wfReq.hs_code} onChange={e => setWfReq(r => ({ ...r, hs_code: e.target.value }))} placeholder="8543.70.90" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (FOB)</label>
                <input className="form-input" type="number" value={wfReq.unit_price || ""} onChange={e => setWfReq(r => ({ ...r, unit_price: e.target.value === "" ? 0 : parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input form-select" value={wfReq.currency} onChange={e => setWfReq(r => ({ ...r, currency: e.target.value }))}>
                  <option value="INR">INR</option>
                  <option value="JPY">JPY</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              {wfReq.currency !== "INR" && (
                <div className="form-group">
                  <label className="form-label">FX Rate (INR per 1 {wfReq.currency})</label>
                  <input className="form-input" type="number" value={wfReq.fx_to_inr || ""} onChange={e => setWfReq(r => ({ ...r, fx_to_inr: parseFloat(e.target.value) || null }))} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Freight / Unit</label>
                <input className="form-input" type="number" value={wfReq.freight_per_unit || ""} onChange={e => setWfReq(r => ({ ...r, freight_per_unit: e.target.value === "" ? 0 : parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Competitor Price (INR, ex-GST)</label>
                <input className="form-input" type="number" value={wfReq.competitor_price_inr || ""} onChange={e => setWfReq(r => ({ ...r, competitor_price_inr: parseFloat(e.target.value) || null }))} placeholder="Optional" />
              </div>
              <div className="form-group">
                <label className="form-label">Business Model</label>
                <select className="form-input form-select" value={wfReq.business_model} onChange={e => setWfReq(r => ({ ...r, business_model: e.target.value }))}>
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={fetchWaterfall} disabled={wfLoading}>
              {wfLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "💧"} Build Waterfall
            </button>
          </div>

          {wfError && <ErrorState message={wfError} onRetry={fetchWaterfall} />}
          {wfLoading && <LoadingState text="Building price waterfall…" />}

          {wfResult && (
            <div className="animate-fadeIn">
              {/* KPI row */}
              <div className="metric-grid" style={{ marginBottom: 20 }}>
                <div className="metric-card">
                  <div className="metric-label">💰 Landed Cost (excl. IGST)</div>
                  <div className="metric-value">{fmt(wfResult.landed_cost_inr)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">🏷 Price (ex-GST)</div>
                  <div className="metric-value">{fmt(wfResult.price_ex_gst_inr)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">🏪 Final Price (incl. GST)</div>
                  <div className="metric-value">{fmt(wfResult.price_incl_gst_inr)}</div>
                </div>
                {wfResult.competitor_price_inr && (
                  <div className="metric-card" style={{ borderTop: `3px solid ${wfResult.price_gap_pct > 0 ? "var(--secondary)" : "var(--success)"}` }}>
                    <div className="metric-label">📊 vs Competitor</div>
                    <div className="metric-value" style={{ fontSize: "1.4rem", color: wfResult.price_gap_pct > 0 ? "var(--secondary)" : "var(--success)" }}>
                      {fmtPct(wfResult.price_gap_pct)}
                    </div>
                    <div className="metric-sub">{wfResult.price_gap_pct > 0 ? "dearer" : "cheaper"} than competitor</div>
                  </div>
                )}
              </div>

              {/* Waterfall chart */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Price Build-Up</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10 }} width={60} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v, n, p) => [fmt(p.payload.kind === "total" ? p.payload.cumulative : p.payload.delta), p.payload.label]} />
                    {wfResult.competitor_price_inr && (
                      <ReferenceLine y={wfResult.competitor_price_inr} stroke="var(--secondary)" strokeDasharray="6 2" label={{ value: "Competitor", position: "insideRight", fontSize: 10 }} />
                    )}
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={KIND_COLORS[entry.kind] || "var(--neutral)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Legend */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                  {Object.entries(KIND_COLORS).map(([kind, color]) => (
                    <div key={kind} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                      {kind}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step breakdown */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>Itemised Breakdown</div>
                <table className="data-table">
                  <thead><tr><th>Step</th><th>Delta</th><th>Cumulative</th></tr></thead>
                  <tbody>
                    {wfResult.steps?.map((s, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: KIND_COLORS[s.kind], flexShrink: 0 }} />
                            {s.label}
                          </div>
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: s.delta_inr < 0 ? "var(--success)" : "var(--text-primary)" }}>
                          {s.delta_inr >= 0 ? "+" : ""}{fmt(s.delta_inr)}
                        </td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: s.kind === "total" ? 800 : 400 }}>
                          {fmt(s.cumulative_inr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {wfResult.assumptions?.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: "0.74rem", color: "var(--text-muted)" }}>
                    <strong>Assumptions:</strong> {wfResult.assumptions.join(" · ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {!wfResult && !wfLoading && !wfError && (
            <EmptyState title="No waterfall yet" description="Configure your product pricing above and click 'Build Waterfall'." />
          )}
        </div>
      )}

      {/* ── GTM Model tab ── */}
      {tab === "model" && (
        <div className="animate-fadeIn">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>GTM Model Configuration</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Product Category</label>
                <select className="form-input form-select" value={mrReq.profile.product_category}
                  onChange={e => setMrReq(r => ({ ...r, profile: { ...r.profile, product_category: e.target.value } }))}>
                  <option value="industrial_sensors">Industrial Sensors</option>
                  <option value="auto_components">Auto Components</option>
                  <option value="consumer_goods">Consumer Goods</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Target Timeline (months)</label>
                <input className="form-input" type="number" value={mrReq.timeline_months}
                  onChange={e => setMrReq(r => ({ ...r, timeline_months: parseInt(e.target.value) || 12 }))} min={1} />
              </div>
              <div className="form-group">
                <label className="form-label">Risk Tolerance</label>
                <select className="form-input form-select" value={mrReq.risk_tolerance}
                  onChange={e => setMrReq(r => ({ ...r, risk_tolerance: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Control Need</label>
                <select className="form-input form-select" value={mrReq.control_need}
                  onChange={e => setMrReq(r => ({ ...r, control_need: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Budget (USD)</label>
                <input className="form-input" type="number" value={mrReq.profile.budget_usd}
                  onChange={e => setMrReq(r => ({ ...r, profile: { ...r.profile, budget_usd: parseFloat(e.target.value) || 10000 } }))} />
              </div>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={mrReq.local_manufacturing_required}
                    onChange={e => setMrReq(r => ({ ...r, local_manufacturing_required: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Local Manufacturing Required</span>
                </label>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={fetchModelRec} disabled={mrLoading}>
              {mrLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "🗺"} Get Recommendations
            </button>
          </div>

          {mrError && <ErrorState message={mrError} onRetry={fetchModelRec} />}
          {mrLoading && <LoadingState text="Analyzing GTM models…" />}

          {mrResult && (
            <div className="animate-fadeIn">
              <div style={{ marginBottom: 12, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                {mrResult.notes?.map((n, i) => <div key={i}>ℹ {n}</div>)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {mrResult.results?.map((opt, i) => (
                  <div key={i} className="card" style={{
                    borderLeft: `4px solid ${i === 0 ? "var(--secondary)" : "var(--border)"}`,
                    background: i === 0 ? "rgba(217,56,30,0.03)" : "var(--bg-card)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          {i === 0 && <span className="chip success">★ Recommended</span>}
                          <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1rem", fontWeight: 700 }}>
                            {opt.model?.replace(/_/g, " ")}
                          </h3>
                        </div>
                        {opt.partner_type && (
                          <span className="chip primary">{opt.partner_type}</span>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 2 }}>Fit Score</div>
                        <ScoreBadge score={opt.score * 10} />
                        <div style={{ fontSize: "0.72rem", color: opt.budget_ok ? "var(--success)" : "var(--danger)", marginTop: 4 }}>
                          {opt.budget_ok ? "✓ Budget OK" : "⚠ Budget tight"}
                          {" · Min "}${opt.indicative_min_budget_usd?.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 12 }}>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--success)", marginBottom: 6 }}>Reasons</div>
                        <ul style={{ paddingLeft: 14, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                          {opt.reasons?.map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--tertiary)", marginBottom: 6 }}>Trade-offs</div>
                        <ul style={{ paddingLeft: 14, fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                          {opt.tradeoffs?.map((t, j) => <li key={j}>{t}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!mrResult && !mrLoading && !mrError && (
            <EmptyState title="No recommendation yet" description="Configure your requirements and click 'Get Recommendations'." />
          )}
        </div>
      )}
    </div>
  );
}
