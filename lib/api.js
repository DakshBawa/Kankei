import { SEED_STATES } from "./seed";
const USE_SEED = process.env.NEXT_PUBLIC_USE_SEED === "1";

async function call(path, opts) {
  const r = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

// GET /api/states -> { states: [...] } or [...]
export async function getStates() {
  if (USE_SEED) return { states: SEED_STATES, source: "seed" };
  try {
    const d = await call("/states");
    const states = Array.isArray(d) ? d : d.states;
    if (!states?.length) throw new Error("empty");
    return { states, source: "api" };
  } catch {
    return { states: SEED_STATES, source: "seed" };
  }
}
// POST /api/brief -> { conclusion?: string, reasons?: string[] }  (Japanese text; optional)
export const postBrief = (body) => call("/brief", { method: "POST", body: JSON.stringify(body) });
// POST /api/contact -> 2xx on success
export const postContact = (body) => call("/contact", { method: "POST", body: JSON.stringify(body) });
