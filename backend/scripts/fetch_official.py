"""Replace a starter corpus document with text pulled from an official page.

Run this on your own machine (it needs internet). Not exercised in the sandbox
where this repo was prepared, so check the first output by eye.

    pip install httpx trafilatura
    python scripts/fetch_official.py bis-crs-qco https://www.bis.gov.in/<exact page>
    python scripts/fetch_official.py gst-basics   https://www.gst.gov.in/<exact page>

Point it at the specific page, not the home page: home pages give the RAG layer
nothing to retrieve. The file keeps its id and title, gets the real source URL,
today's date as last_verified, and status: fetched.
"""
from __future__ import annotations

import re
import sys
from datetime import date
from pathlib import Path

import httpx
import trafilatura

CORPUS = Path("data/corpus")
MAX_CHARS = 6000  # keep chunks small enough to embed and cite


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    slug, url = sys.argv[1], sys.argv[2]
    path = CORPUS / f"{slug}.md"
    if not path.exists():
        print(f"{path} not found. Run seed_corpus.py first.")
        return 1

    html = httpx.get(url, timeout=30, follow_redirects=True,
                     headers={"User-Agent": "Mozilla/5.0 (Kankei research)"}).text
    text = trafilatura.extract(html, include_comments=False, include_tables=True)
    if not text or len(text) < 400:
        print("Little or no text extracted. The page may need JavaScript; copy the text in by hand.")
        return 1

    old = path.read_text(encoding="utf-8")
    title = re.search(r"^title: (.*)$", old, re.M).group(1)
    authority = re.search(r"^authority: (.*)$", old, re.M).group(1)
    path.write_text(
        "---\n"
        f"id: {slug}\n"
        f"title: {title}\n"
        f"authority: {authority}\n"
        f"source_url: {url}\n"
        f"last_verified: {date.today().isoformat()}\n"
        "status: fetched\n"
        "---\n\n"
        f"# {title}\n\n{text[:MAX_CHARS]}\n",
        encoding="utf-8",
    )
    print(f"updated {path} ({min(len(text), MAX_CHARS)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
