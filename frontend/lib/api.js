// Centralized API client — all backend calls go through here.
// Set NEXT_PUBLIC_API_URL (defaults to http://localhost:8000).
// Set NEXT_PUBLIC_USE_MOCKS=true to use seed fixtures instead.

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function call(path, opts = {}) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`${path} → ${r.status}: ${body}`);
  }
  return r.json();
}

// ── Health ────────────────────────────────────────────────────────────────────
export const getHealth = () => call("/health");

// ── Session ───────────────────────────────────────────────────────────────────
export const createSession = () => call("/session", { method: "POST" });
export const getSession = (id) => call(`/session/${id}`);
export const patchSession = (id, patch) =>
  call(`/session/${id}`, { method: "PATCH", body: JSON.stringify(patch) });

// ── Research ──────────────────────────────────────────────────────────────────
export const rankStates = (profile, top_n) =>
  call(`/research/rank${top_n ? `?top_n=${top_n}` : ""}`, {
    method: "POST",
    body: JSON.stringify(profile),
  });

export const getMarketBrief = (profile, state = null) =>
  call("/research/brief", {
    method: "POST",
    body: JSON.stringify({ profile, state }),
  });

export const askResearch = (question, state = null, language = "en") =>
  call("/research/ask", {
    method: "POST",
    body: JSON.stringify({ question, state, language }),
  });

// ── Match ─────────────────────────────────────────────────────────────────────
export const listPartners = (params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return call(`/match/partners${q ? `?${q}` : ""}`);
};
export const getPartnerTrust = (partnerId) => call(`/match/partners/${partnerId}/trust`);
export const rankPartners = (req) =>
  call("/match/rank", { method: "POST", body: JSON.stringify(req) });

// ── Comply ────────────────────────────────────────────────────────────────────
export const searchHS = (q) => call(`/comply/hs?q=${encodeURIComponent(q)}`);
export const getLandedCost = (req) =>
  call("/comply/landed-cost", { method: "POST", body: JSON.stringify(req) });
export const getChecklist = (req) =>
  call("/comply/checklist", { method: "POST", body: JSON.stringify(req) });
export const explainCompliance = (req) =>
  call("/comply/explain", { method: "POST", body: JSON.stringify(req) });

// ── GTM ───────────────────────────────────────────────────────────────────────
export const getPriceWaterfall = (req) =>
  call("/gtm/price-waterfall", { method: "POST", body: JSON.stringify(req) });
export const getModelRecommendation = (req) =>
  call("/gtm/recommend-model", { method: "POST", body: JSON.stringify(req) });

// ── Culture ───────────────────────────────────────────────────────────────────
export const getPlaybook = () => call("/culture/playbook");
export const checkPhrase = (text) =>
  call("/culture/phrase-check", { method: "POST", body: JSON.stringify({ text }) });
export const coachMessage = (req) =>
  call("/culture/coach", { method: "POST", body: JSON.stringify(req) });
