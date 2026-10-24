# Kankei critical fixes: how to drop them in

Copy the folder contents over your repo root (same paths). Then:

1. **main.py**: add
   ```python
   from app import session
   app.include_router(session.router)
   ```
   and make sure CORS reads `CORS_ORIGINS` and `/health` exists.
2. **LLM calls**: replace every direct provider call with `from app.llm import complete_json, complete_text`.
   Pass a deterministic `fallback=` for each (template text built from your data), so the UI never shows an error.
3. **session.py stages**: open the `_stage_*` functions and rename the imports to your real function names (marked `# ADAPT`).
4. **culture/coach.py**: load `data/culture_playbook.json`, keep entries whose `pattern` appears in the input
   (substring match), and put only those entries in the LLM prompt. Keep the prompt free of timestamps or random ids,
   or the cache key changes on every call.
5. **requirements.txt**: merge `backend/requirements.txt.example`.
6. `cp .env.example .env`, fill `LLM_MODEL` and `LLM_API_KEY`, then `docker compose up --build`.
7. Warm and prove offline: `./verify_offline.sh`, then commit `backend/data/llm_cache/`.
8. Before the final demo, replace the starter corpus bodies with official text:
   `python scripts/fetch_official.py <slug> <exact page URL>` (see the script header).

Run the tests: `cd backend && pip install pytest pyyaml && python -m pytest tests -q`
