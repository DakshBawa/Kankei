import { SEED_STATES } from "./seed";
const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true" || process.env.NEXT_PUBLIC_USE_SEED === "1";

async function call(path, opts) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

// GET states -> { states: [...] } or [...]
export async function getStates() {
  if (USE_MOCKS) return { states: SEED_STATES, source: "seed" };
  try {
    const d = await call("/research/rank", {
      method: "POST",
      body: JSON.stringify({ product_category: "industrial_sensors", budget_usd: 100000 })
    });
    const states = Array.isArray(d) ? d : (d.results || d.states);
    if (!states?.length) throw new Error("empty");
    return { states, source: "api" };
  } catch {
    return { states: SEED_STATES, source: "seed" };
  }
}
// POST /research/brief -> { conclusion?: string, reasons?: string[] }
export const postBrief = (body) => call("/research/brief", { method: "POST", body: JSON.stringify(body) });
// POST /contact -> 2xx on success
export const postContact = (body) => call("/contact", { method: "POST", body: JSON.stringify(body) });
