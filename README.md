# India Site Selector: Next.js frontend

Next.js 14 (App Router, JavaScript). Sliders re-rank **locally** (instant); data and extras come from your backend.

## Run
```bash
npm install
cp .env.example .env.local     # set BACKEND_URL
npm run dev                    # http://localhost:3000
```
`next.config.mjs` proxies `/api/*` to `BACKEND_URL`, so the browser never hits your backend directly (no CORS setup).
If the backend is down (or `NEXT_PUBLIC_USE_SEED=1`) the app falls back to demo data and shows a "Demo data" badge.

## Backend contract (adjust `lib/api.js` if yours differs)

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/states` | none | `{ "states": [State] }` or `[State]` |
| POST | `/api/brief` *(optional)* | `{ persona, weights, ranking:[{code,score}] }` | `{ "conclusion"?: string, "reasons"?: string[] }` Japanese text |
| POST | `/api/contact` | `{ name, email, message }` | any 2xx |

```jsonc
// State
{ "code": "GJ", "name": "Gujarat", "nameJa": "グジャラート",
  "col": 1, "row": 4,                       // tile position on the 9x8 grid
  "scores": [82,72,88,90,92,92],            // cost, talent, infra, policy, logistics, ease (0-100)
  "sectors": ["ph","au","tx","fd"] }        // sector clusters: el au ph tx fd
// persona
{ "company": "...", "sector": "el", "investment": 50, "headcount": 800, "exporter": true }
```
Express example:
```js
app.get("/api/states", (req, res) => res.json({ states }));
```

## Structure
```
app/            layout.js, page.js (state + wiring), globals.css
components/     Navbar (floating menu), Hero, PersonaForm, WeightSliders, IndiaMap,
                Ranking, WhyCard, TopPicks, SourcesLoop, Info, ContactForm, Footer,
                ScrollToTop, BriefModal
lib/            api.js, scoring.js, seed.js (demo data), i18n.js + lang.jsx (EN/JA)
```
Seed scores are placeholders. Real figures should come from `/api/states`.
