#!/bin/sh
# Prove the demo works with no network. Run ONCE online first so the cache is warm.
set -e
API=${API:-http://localhost:8000}

echo "1) warm the cache (online): one call runs every stage, including the LLM ones"
curl -fsS -X POST "$API/session/seed-demo" | python3 -c "import sys,json; s=json.load(sys.stdin)['stages']; print({k:v['ok'] for k,v in s.items()})"
echo "   cache entries now in backend/data/llm_cache: $(find backend/data/llm_cache -name '*.json' | wc -l)"

echo "2) restart the backend in offline mode"
LLM_OFFLINE=1 docker compose up -d --force-recreate backend
until curl -fsS "$API/health" >/dev/null 2>&1; do sleep 2; done

echo "3) seed again with the network unused"
curl -fsS -X POST "$API/session/seed-demo" | python3 -c "import sys,json; s=json.load(sys.stdin)['stages']; print({k:v['ok'] for k,v in s.items()}); sys.exit(0 if all(v['ok'] for v in s.values()) else 1)" \
  && echo "OFFLINE DEMO OK" || echo "Some stages failed offline: warm the cache again, or add a fallback to that LLM call"
echo "Commit backend/data/llm_cache so the warmed answers ship with the repo."
