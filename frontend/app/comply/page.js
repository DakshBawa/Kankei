"use client";
import { useState } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { getChecklist, getLandedCost, searchHS, explainCompliance, patchSession } from "@/lib/api";
import {
  Citations, LoadingState, ErrorState, EmptyState, Skeleton
} from "@/components/UI";

const PHASE_ORDER = ["pre_entry", "setup", "import", "ongoing"];
const PHASE_LABELS = { pre_entry: "Pre-Entry", setup: "Setup", import: "Import", ongoing: "Ongoing" };
const PHASE_COLORS = { pre_entry: "var(--secondary)", setup: "var(--primary)", import: "var(--tertiary)", ongoing: "var(--success)" };

export default function ComplyPage() {
  const { lang, session, setSession } = useApp();
  const tr = useT(lang);
  const [tab, setTab] = useState("checklist");

  // Checklist state
  const [clReq, setClReq] = useState({
    entry_model: "export_via_distributor",
    product_category: "industrial_sensors",
    business_model: "B2B",
    hs_code: "",
    has_wireless: false,
    sold_prepackaged_retail: false,
  });
  const [checklist, setChecklist] = useState(null);
  const [clLoading, setClLoading] = useState(false);
  const [clError, setClError] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [explanation, setExplanation] = useState(null);

  // Landed cost state
  const [lcReq, setLcReq] = useState({
    hs_code: "8543.70.90",
    goods_value: 100000,
    currency: "INR",
    fx_to_inr: null,
    freight: 5000,
    insurance: 1000,
    landing_charge_pct: 1.0,
    bcd_override_pct: null,
  });
  const [lcResult, setLcResult] = useState(null);
  const [lcLoading, setLcLoading] = useState(false);
  const [lcError, setLcError] = useState(null);
  const [hsSearch, setHsSearch] = useState("");
  const [hsResults, setHsResults] = useState([]);
  const [hsSearchLoading, setHsSearchLoading] = useState(false);

  const fetchChecklist = async () => {
    setClLoading(true); setClError(null);
    try {
      const data = await getChecklist(clReq);
      setChecklist(data);
      setSession({ ...session, comply: data?.items || [] });
      try { await patchSession(session.session_id, { comply: data?.items || [] }); } catch {}
    } catch (e) {
      setClError(e.message);
    } finally {
      setClLoading(false);
    }
  };

  const fetchLandedCost = async () => {
    setLcLoading(true); setLcError(null);
    try {
      const req = { ...lcReq };
      if (req.currency === "INR") { delete req.fx_to_inr; }
      if (req.currency !== "INR" && !req.fx_to_inr) {
        setLcError(`FX rate (INR per 1 ${req.currency}) is required.`);
        return;
      }
      if (!req.bcd_override_pct) { delete req.bcd_override_pct; }
      const data = await getLandedCost(req);
      setLcResult(data);
    } catch (e) {
      setLcError(e.message);
    } finally {
      setLcLoading(false);
    }
  };

  const handleHsSearch = async () => {
    if (hsSearch.length < 2) return;
    setHsSearchLoading(true);
    try {
      const r = await searchHS(hsSearch);
      setHsResults(Array.isArray(r) ? r : r.results || []);
    } catch { setHsResults([]); }
    finally { setHsSearchLoading(false); }
  };

  const handleExplain = async (item) => {
    if (expandedItem === item.id) { setExpandedItem(null); return; }
    setExpandedItem(item.id); setExplanation(null);
    try {
      const r = await explainCompliance({ item_id: item.id, query: item.title, context: item.description, language: lang });
      setExplanation(r);
    } catch {}
  };

  const grouped = checklist?.items ? PHASE_ORDER.reduce((acc, phase) => {
    const items = checklist.items.filter(i => i.phase === phase);
    if (items.length) acc[phase] = items;
    return acc;
  }, {}) : {};

  const fmt = (n) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—");

  return (
    <div className="animate-fadeIn">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ fontSize: "1.3rem" }}>Compliance & GTM</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: 4 }}>
            Regulatory roadmap, landed cost calculator, and compliance checklist
          </p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "checklist" ? "active" : ""}`} onClick={() => setTab("checklist")}>Regulatory Roadmap</button>
        <button className={`tab ${tab === "landed" ? "active" : ""}`} onClick={() => setTab("landed")}>Landed Cost</button>
      </div>

      {/* ── Compliance Checklist tab ── */}
      {tab === "checklist" && (
        <div className="animate-fadeIn">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Configure Regulatory Profile</div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Entry Model</label>
                <select className="form-input form-select" value={clReq.entry_model} onChange={e => setClReq(r => ({ ...r, entry_model: e.target.value }))}>
                  <option value="export_via_distributor">Export via Distributor</option>
                  <option value="contract_manufacturing">Contract Manufacturing</option>
                  <option value="joint_venture">Joint Venture</option>
                  <option value="wholly_owned_subsidiary">Wholly Owned Subsidiary</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Product Category</label>
                <select className="form-input form-select" value={clReq.product_category} onChange={e => setClReq(r => ({ ...r, product_category: e.target.value }))}>
                  <option value="industrial_sensors">Industrial Sensors</option>
                  <option value="auto_components">Auto Components</option>
                  <option value="consumer_goods">Consumer Goods</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">HS Code (optional)</label>
                <input className="form-input" value={clReq.hs_code} onChange={e => setClReq(r => ({ ...r, hs_code: e.target.value }))} placeholder="e.g. 8543.70.90" />
              </div>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={clReq.has_wireless} onChange={e => setClReq(r => ({ ...r, has_wireless: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Has Wireless / WPC</span>
                </label>
              </div>
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={clReq.sold_prepackaged_retail} onChange={e => setClReq(r => ({ ...r, sold_prepackaged_retail: e.target.checked }))} />
                  <span className="form-label" style={{ margin: 0 }}>Pre-packaged Retail</span>
                </label>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn btn-primary w-full" onClick={fetchChecklist} disabled={clLoading}>
                  {clLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : ""} Generate Roadmap
                </button>
              </div>
            </div>
          </div>

          {clError && <ErrorState message={clError} onRetry={fetchChecklist} />}

          {clLoading ? (
            <div className="card"><Skeleton count={6} /></div>
          ) : checklist ? (
            <div className="animate-fadeIn">
              <div style={{ marginBottom: 12, fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Rules status: <strong>{checklist.rules_status}</strong> · {checklist.items?.length} items
              </div>
              {Object.entries(grouped).map(([phase, items]) => (
                <div key={phase} style={{ marginBottom: 24 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                    padding: "8px 14px", background: `${PHASE_COLORS[phase]}15`,
                    borderRadius: "var(--radius-sm)", borderLeft: `3px solid ${PHASE_COLORS[phase]}`
                  }}>
                    <span style={{ fontWeight: 700, color: PHASE_COLORS[phase], fontSize: "0.84rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {PHASE_LABELS[phase]}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>{items.length} steps</span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ marginBottom: 8 }}>
                      <div
                        className="card"
                        style={{ padding: "12px 16px", cursor: "pointer", transition: "all 0.15s" }}
                        onClick={() => handleExplain(item)}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = ""}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                              <span style={{
                                width: 20, height: 20, borderRadius: "50%",
                                background: PHASE_COLORS[phase], color: "#fff",
                                fontSize: "0.65rem", fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                              }}>{idx + 1}</span>
                              <span style={{ fontWeight: 600, fontSize: "0.86rem" }}>{item.title}</span>
                              {item.applicability === "check" && <span className="chip warning">Conditional</span>}
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", paddingLeft: 28 }}>
                              {item.authority} · {item.area}
                            </div>
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", flexShrink: 0 }}>
                            {expandedItem === item.id ? "▲" : "▼"} Details
                          </span>
                        </div>

                        {expandedItem === item.id && (
                          <div className="animate-fadeIn" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.6 }}>{item.description}</p>
                            <div style={{ fontSize: "0.78rem", marginBottom: 4 }}><strong>Action:</strong> {item.action}</div>
                            <div style={{ fontSize: "0.78rem", marginBottom: 4 }}><strong>Verification:</strong> {item.verification}</div>
                            {item.source_hint && (
                              <div style={{ fontSize: "0.76rem", color: "var(--info)", marginTop: 6 }}>
                                📄 Source: {item.source_hint}
                              </div>
                            )}
                            {explanation && (
                              <div style={{ marginTop: 10, background: "#eff6ff", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
                                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>AI Explanation</div>
                                <p style={{ fontSize: "0.8rem", color: "#1e3a8a" }}>{explanation.explanation}</p>
                                <Citations citations={explanation.citations || []} />
                              </div>
                            )}
                            <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                              Disclaimer: This is AI-generated guidance only. Consult a qualified Indian legal or compliance advisor for authoritative advice.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No roadmap yet" description="Configure your profile above and click 'Generate Roadmap' to get your regulatory checklist." />
          )}
        </div>
      )}

      {/* ── Landed Cost tab ── */}
      {tab === "landed" && (
        <div className="animate-fadeIn">
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 16 }}>Landed Cost Calculator</div>

            {/* HS search */}
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Search HS Code</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" value={hsSearch} onChange={e => setHsSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleHsSearch()}
                  placeholder="Type HS code or description…" />
                <button className="btn btn-outline btn-sm" onClick={handleHsSearch} disabled={hsSearchLoading}>
                  {hsSearchLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "Search"}
                </button>
              </div>
              {hsResults.length > 0 && (
                <div style={{ marginTop: 8, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", maxHeight: 180, overflowY: "auto" }}>
                  {hsResults.slice(0, 8).map((r, i) => (
                    <div key={i} style={{ padding: "8px 14px", cursor: "pointer", fontSize: "0.8rem", borderBottom: "1px solid var(--border)" }}
                      onClick={() => { setLcReq(q => ({ ...q, hs_code: r.hs_code || r.code })); setHsResults([]); setHsSearch(r.hs_code || r.code); }}>
                      <strong>{r.hs_code || r.code}</strong> — {r.description}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid-3" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">HS Code *</label>
                <input className="form-input" value={lcReq.hs_code} onChange={e => setLcReq(r => ({ ...r, hs_code: e.target.value }))} placeholder="8543.70.90" required />
              </div>
              <div className="form-group">
                <label className="form-label">Goods Value (FOB)</label>
                <input className="form-input" type="number" value={lcReq.goods_value || ""} onChange={e => setLcReq(r => ({ ...r, goods_value: e.target.value === "" ? 0 : parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input form-select" value={lcReq.currency} onChange={e => setLcReq(r => ({ ...r, currency: e.target.value }))}>
                  <option value="INR">INR</option>
                  <option value="JPY">JPY</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              {lcReq.currency !== "INR" && (
                <div className="form-group">
                  <label className="form-label">FX Rate (INR per 1 {lcReq.currency})</label>
                  <input className="form-input" type="number" value={lcReq.fx_to_inr || ""} onChange={e => setLcReq(r => ({ ...r, fx_to_inr: parseFloat(e.target.value) || null }))} placeholder={lcReq.currency === "JPY" ? "0.54" : "83"} required />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Freight</label>
                <input className="form-input" type="number" value={lcReq.freight || ""} onChange={e => setLcReq(r => ({ ...r, freight: e.target.value === "" ? 0 : parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance</label>
                <input className="form-input" type="number" value={lcReq.insurance || ""} onChange={e => setLcReq(r => ({ ...r, insurance: e.target.value === "" ? 0 : parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">BCD Override % (CEPA)</label>
                <input className="form-input" type="number" value={lcReq.bcd_override_pct || ""} onChange={e => setLcReq(r => ({ ...r, bcd_override_pct: parseFloat(e.target.value) || null }))} placeholder="Leave blank for standard rate" />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={fetchLandedCost} disabled={lcLoading || !lcReq.hs_code}>
              {lcLoading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : ""} Calculate Landed Cost
            </button>
          </div>

          {lcError && <ErrorState message={lcError} onRetry={fetchLandedCost} />}

          {lcLoading && <LoadingState text="Calculating landed cost…" />}

          {lcResult && (
            <div className="animate-fadeIn">
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div className="card-title">Results: HS {lcResult.hs_code}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{lcResult.description}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Landed Cost (incl. IGST)</div>
                    <div style={{ fontSize: "1.6rem", fontWeight: 800, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "var(--primary)" }}>
                      {fmt(lcResult.landed_cost_inr)}
                    </div>
                  </div>
                </div>

                {/* Cost lines */}
                <div style={{ marginBottom: 16 }}>
                  {lcResult.lines?.map((line, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
                      <div>
                        <span style={{ fontWeight: 500 }}>{line.label}</span>
                        <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: "0.74rem" }}>({line.basis})</span>
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmt(line.amount_inr)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 700, fontSize: "0.9rem" }}>
                    <span>Excl. IGST (if claiming ITC)</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "var(--success)" }}>{fmt(lcResult.landed_cost_excl_igst_inr)}</span>
                  </div>
                </div>

                <div className="grid-3" style={{ gap: 10, fontSize: "0.78rem" }}>
                  <div style={{ background: "var(--bg)", padding: 10, borderRadius: "var(--radius-sm)" }}>
                    <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Effective Duty %</div>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{lcResult.effective_duty_pct_of_av?.toFixed(1)}%</div>
                  </div>
                  <div style={{ background: "var(--bg)", padding: 10, borderRadius: "var(--radius-sm)" }}>
                    <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>GST Rate</div>
                    <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{lcResult.gst_rate_pct}%</div>
                  </div>
                  <div style={{ background: lcResult.matches_reference ? "#f0fdf4" : "#fef2f2", padding: 10, borderRadius: "var(--radius-sm)" }}>
                    <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>Verification</div>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: lcResult.matches_reference ? "var(--success)" : "var(--danger)" }}>
                      {lcResult.verification_status}
                    </div>
                  </div>
                </div>

                {lcResult.notes?.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: "0.76rem", color: "var(--text-muted)" }}>
                    {lcResult.notes.map((n, i) => <div key={i}>{n}</div>)}
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Source: {lcResult.source} — Verify current rates with Indian Customs before finalising import budgets.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
