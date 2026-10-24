"use client";
import { useState, useEffect } from "react";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { rankPartners, listPartners, getPartnerTrust, patchSession } from "@/lib/api";
import {
  ScoreBadge, TierBadge, FactorBreakdown,
  LoadingState, ErrorState, EmptyState, RiskFlag, Skeleton
} from "@/components/UI";

const DEFAULT_REQ = {
  profile: { product_category: "industrial_sensors", business_model: "B2B", budget_usd: 33333, priority_weights: {} },
  partner_types: [],
  states: [],
  competitor_brands: [],
  language_need: "english",
  exclude_high_risk: true,
  min_trust: 0,
  top_n: 10,
};

export default function MatchPage() {
  const { lang, session, setSession } = useApp();
  const tr = useT(lang);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [req, setReq] = useState(DEFAULT_REQ);
  const [showFilters, setShowFilters] = useState(false);

  const fetchPartners = async () => {
    setLoading(true); setError(null);
    try {
      const data = await rankPartners(req);
      setPartners(data.results || []);
      setSession({ ...session, match: data.results || [] });
      try { await patchSession(session.session_id, { match: data.results || [] }); } catch {}
    } catch (e) {
      // Try list partners as fallback
      try {
        const list = await listPartners();
        setPartners(list.map(p => ({ partner: p, match_score: 0, fit_score: 0, trust: null, fit_components: [], state_opportunity_score: 0, conflicts: [], reasons: [] })));
      } catch {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.match && Array.isArray(session.match)) {
      setPartners(session.match);
    } else {
      fetchPartners();
    }
  }, [session]);

  const filtered = partners.filter(p => {
    const name = p.partner?.name || "";
    const type = p.partner?.type || "";
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || type === filterType;
    return matchSearch && matchType;
  });

  return (
    <div className="animate-fadeIn">
      <div className="section-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="section-title" style={{ fontSize: "1.3rem" }}>🤝 Partner Matching</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: 4 }}>
            AI-ranked partners by Fit + Trust scores — vetted for Japan experience
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowFilters(!showFilters)}>⚙ Filters</button>
          <button className="btn btn-primary btn-sm" onClick={fetchPartners} disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : "↺"} Re-rank
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card animate-fadeIn" style={{ marginBottom: 20 }}>
          <div className="grid-3" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Partner Type</label>
              <select className="form-input form-select" value={req.partner_types[0] || ""} onChange={e => setReq(r => ({ ...r, partner_types: e.target.value ? [e.target.value] : [] }))}>
                <option value="">All types</option>
                <option>Distributor</option>
                <option>Contract Manufacturer</option>
                <option>JV Candidate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Language Need</label>
              <select className="form-input form-select" value={req.language_need} onChange={e => setReq(r => ({ ...r, language_need: e.target.value }))}>
                <option value="any">Any</option>
                <option value="english">English</option>
                <option value="japanese">Japanese</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min Trust Score</label>
              <input type="range" min={0} max={100} value={req.min_trust}
                onChange={e => setReq(r => ({ ...r, min_trust: parseFloat(e.target.value) }))} style={{ width: "100%" }} />
              <span style={{ fontSize: "0.74rem" }}>{req.min_trust}</span>
            </div>
            <div className="form-group">
              <label className="form-label">Exclude High Risk</label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={req.exclude_high_risk} onChange={e => setReq(r => ({ ...r, exclude_high_risk: e.target.checked }))} />
                <span style={{ fontSize: "0.82rem" }}>Exclude high-risk partners</span>
              </label>
            </div>
            <div className="form-group">
              <label className="form-label">Top N Results</label>
              <input type="number" className="form-input" min={1} max={50} value={req.top_n} onChange={e => setReq(r => ({ ...r, top_n: parseInt(e.target.value) || 10 }))} />
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="btn btn-primary btn-sm w-full" onClick={fetchPartners}>Apply Filters →</button>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="form-input" placeholder="Search partners by name…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <select className="form-input form-select" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">All types</option>
          <option>Distributor</option>
          <option>Contract Manufacturer</option>
          <option>JV Candidate</option>
        </select>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", alignSelf: "center" }}>
          {filtered.length} of {partners.length} partners
        </span>
      </div>

      {error && <ErrorState message={error} onRetry={fetchPartners} />}

      <div className="grid-2" style={{ alignItems: "flex-start" }}>
        {/* Partner list */}
        <div>
          {loading ? (
            <div className="card"><Skeleton count={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No partners found" description="Adjust filters or click Re-rank to load from backend." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map((r, i) => {
                const p = r.partner;
                return (
                  <div
                    key={p.partner_id || i}
                    className="card"
                    style={{
                      cursor: "pointer",
                      borderLeft: selected?.partner?.partner_id === p.partner_id ? "3px solid var(--secondary)" : "3px solid transparent",
                      padding: "14px 16px",
                      transition: "all 0.15s",
                    }}
                    onClick={() => setSelected(r)}
                    onMouseEnter={(e) => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                    onMouseLeave={(e) => e.currentTarget.style.boxShadow = ""}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{p.name}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {p.type} · {p.state} · {p.sector}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {r.trust && <TierBadge tier={r.trust.tier} />}
                        <ScoreBadge score={r.match_score || 0} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                      <span>Fit: <strong>{r.fit_score?.toFixed?.(1) || "—"}</strong></span>
                      <span>Trust: <strong>{r.trust?.score?.toFixed?.(1) || "—"}</strong></span>
                      <span>{p.japan_client_experience}</span>
                      <span>{p.language}</span>
                    </div>
                    {r.conflicts?.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {r.conflicts.map((c, j) => <span key={j} className="chip danger">{c}</span>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Partner detail */}
        <div>
          {selected ? (
            <div className="card animate-fadeIn">
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "1.1rem", fontWeight: 800 }}>
                      {selected.partner.name}
                    </h2>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {selected.partner.type} · {selected.partner.state} · {selected.partner.sector}
                    </div>
                  </div>
                  <ScoreBadge score={selected.match_score} size="lg" />
                </div>
              </div>

              {/* Score breakdown */}
              <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Fit Score</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>{selected.fit_score?.toFixed(1)}</div>
                </div>
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Trust Score</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>
                    {selected.trust?.score?.toFixed(1) || "—"}
                    {selected.trust && <TierBadge tier={selected.trust.tier} />}
                  </div>
                </div>
              </div>

              {/* Trust flags */}
              {selected.trust?.flags?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Risk Flags</div>
                  {selected.trust.flags.map((f, i) => <RiskFlag key={i} flag={f} level="amber" />)}
                </div>
              )}

              {/* Conflict alerts */}
              {selected.conflicts?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--danger)", marginBottom: 8 }}>Conflict Alerts</div>
                  {selected.conflicts.map((c, i) => <RiskFlag key={i} flag={c} level="red" />)}
                </div>
              )}

              {/* Fit components */}
              {selected.fit_components?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 10 }}>Fit Score Breakdown</div>
                  <FactorBreakdown factors={selected.fit_components.map(c => ({ factor: c.name, value: c.score / 100, weight: c.weight, contribution: c.score * c.weight / 100 }))} />
                </div>
              )}

              {/* Reasons */}
              {selected.reasons?.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 8 }}>Why This Partner?</div>
                  <ul style={{ paddingLeft: 16, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {selected.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}

              {/* Partner details */}
              <div style={{ marginTop: 16, padding: "12px 0", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.78rem" }}>
                <div><span style={{ color: "var(--text-muted)" }}>Turnover Band:</span> {selected.partner.turnover_band}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Years in Business:</span> {selected.partner.years_in_business}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Language:</span> {selected.partner.language}</div>
                <div><span style={{ color: "var(--text-muted)" }}>Japan XP:</span> {selected.partner.japan_client_experience}</div>
                {selected.partner.brands_handled?.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={{ color: "var(--text-muted)" }}>Brands Handled: </span>
                    {selected.partner.brands_handled.map((b, i) => <span key={i} className="chip" style={{ marginRight: 4 }}>{b}</span>)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card">
              <EmptyState title="Select a partner" description="Click a partner card to view their full profile, scores, and risk analysis." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
