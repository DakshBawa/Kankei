# Kankei backend

FastAPI service. Five modules, one LLM wrapper (`app/llm.py`), one schema file (`app/schemas.py`).

```
backend/
├── app/
│   ├── main.py  config.py  llm.py  schemas.py
│   └── modules/
│       ├── research/  scoring.py  rag.py  routes.py
│       ├── match/     data.py  trust.py  fit.py  routes.py
│       ├── comply/    rules.yaml  engine.py  landed_cost.py  routes.py
│       ├── gtm/       waterfall.py  model_recommender.py  routes.py
│       └── culture/   playbook.json  coach.py  routes.py
├── data/   states_scores_comparison.csv  partners.csv  hs_duties.csv  docs/ (drop RAG docs here)
├── tests/  Dockerfile  requirements.txt  .env.example
```

## Run
```
pip install -r requirements.txt
cp .env.example .env          # set ANTHROPIC_API_KEY (only needed for /research/brief, /research/ask, /culture/coach)
uvicorn app.main:app --reload # docs at http://localhost:8000/docs
pytest                        # 25 tests, no API key needed
```

## Endpoints
| Route | What it does | LLM |
|---|---|---|
| `POST /research/rank` | Rank 10 states for an SME profile; 9 factors, `top_factors` for the "why" | no |
| `POST /research/brief` | JA + EN market brief with citations | yes |
| `POST /research/ask` | RAG Q&A over state data + `data/docs/` | yes |
| `GET /match/partners`, `GET /match/partners/{id}/trust` | Browse partners, trust report | no |
| `POST /match/rank` | Fit x trust ranking, competitor-brand conflicts, high-risk exclusion | no |
| `GET /comply/hs?q=`, `GET /comply/hs/audit` | HS lookup; audit of the duty table | no |
| `POST /comply/landed-cost` | BCD -> SWS -> IGST cascade, FX, CEPA override | no |
| `POST /comply/checklist` | Entry-model checklist from `rules.yaml` | no |
| `POST /gtm/price-waterfall` | FOB price -> shelf price with channel margins and competitor gap | no |
| `POST /gtm/recommend-model` | Rank distributor / contract mfg / JV / subsidiary | no |
| `GET /culture/playbook`, `POST /culture/phrase-check` | Playbook; flag commonly misread phrases | no |
| `POST /culture/coach` | Explain misreadings and rewrite a message | yes |

## Data notes (read before the demo)
- **States**: all inputs are min-max normalised across the 10 states, so 0 means "worst of the ten", not "none". Land cost is already a *competitiveness* score (higher = cheaper), so it is not inverted. Equal weights reproduce your `overall_composite_score` (tested). Data is dated 2024-10.
- **Duty table**: the `effective_duty` column is wrong for 5 of 8 rows (e.g. 26.98% listed, cascade gives 27.735%). The engine calculates the cascade itself; see `GET /comply/hs/audit`. All rows are marked "verify against CBIC".
- **`rules.yaml` is a starter set, every item `unverified`** - a prompt for what to check, not legal advice.
- **Heuristics you should tune**: category weights (`scoring.py`), trust weights/tiers (`trust.py`), sector affinity (`fit.py`), default channel margins (`waterfall.py`), budget thresholds and attribute scores (`model_recommender.py`).
- **Playbook romanisation**: it spells the "we will consider it" phrases as "Zenshin shimasu / Sento shimasu". The usual forms are 善処します (zensho shimasu) and 検討します (kento shimasu); `coach.py` matches both spellings.
- **RAG**: with no files in `data/docs/`, retrieval only covers the per-state data chunks, so competitor/customer sections of briefs will say "not in corpus". Add real market reports as `.md`/`.txt`.
