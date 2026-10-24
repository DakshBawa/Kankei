import { PRESETS } from "./seed";

export function presetWeights(p) {
  const w = [...PRESETS[p.sector]];
  if (p.headcount > 2000) { w[1]++; w[0]++; }
  if (p.investment > 200) w[3]++;
  if (p.exporter) w[4] += 2;
  return w.map((v) => Math.min(10, v));
}

// Runs locally so sliders re-rank instantly (no network round-trip).
export function rank(states, w, sector) {
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return states
    .map((s) => ({ ...s, score: s.scores.reduce((a, x, i) => a + x * w[i], 0) / sum + (s.sectors?.includes(sector) ? 4 : 0) }))
    .sort((a, b) => b.score - a.score);
}

// Per-factor edge over the all-state average, weighted. Sorted best-first.
export function edges(states, state, w) {
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return state.scores
    .map((v, i) => {
      const avg = states.reduce((a, s) => a + s.scores[i], 0) / states.length;
      return { i, v, d: v - avg, imp: ((v - avg) * w[i]) / sum };
    })
    .sort((a, b) => b.imp - a.imp);
}

export function tileColor(t) {
  const a = [230, 225, 210], b = [28, 52, 92];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t))})`;
}
