import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import yaml
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import DATA_DIR
from app.modules.research.scoring import load_states

MIN_SIMILARITY = 0.05
STATE_SOURCE = "states_scores_comparison.csv"


@dataclass
class Chunk:
    chunk_id: str  # "<source>#<n or state>"
    source: str
    text: str
    title: str = ""
    source_url: str = ""
    last_verified: str = "UNVERIFIED"
    status: str = "starter-summary"
    authority: str = ""
    score: float = 0.0

    @property
    def is_state_chunk(self) -> bool:
        return self.source == STATE_SOURCE

    @property
    def unverified(self) -> bool:
        return self.status == "starter-summary" or self.last_verified == "UNVERIFIED"


def _parse_front_matter(content: str) -> tuple[dict, str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if not match:
        return {}, content
    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except Exception:
        meta = {}
    return meta, match.group(2)


def _chunk_text(text: str, max_chars: int = 900) -> list[str]:
    chunks, buf = [], ""
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        if buf and len(buf) + len(para) > max_chars:
            chunks.append(buf)
            buf = para
        else:
            buf = f"{buf}\n\n{para}" if buf else para
    if buf:
        chunks.append(buf)
    return chunks


def _state_text(state: str, r) -> str:
    return (
        f"{state}: industrial output index {r['industrial_output_raw']}; auto cluster density "
        f"{r['auto_cluster_density_raw']}/10; Japanese companies {int(r['japanese_companies_raw'])}; "
        f"port/logistics score {r['port_logistics_score_raw']}; average industrial land cost "
        f"INR {int(r['avg_industrial_land_cost_inr_sqm'])}/sqm; skilled labour score "
        f"{r['skilled_labor_score_raw']}; state incentive score {r['state_incentive_score_raw']}; "
        f"ease of doing business {r['ease_of_doing_business_raw']}; power reliability "
        f"{r['power_reliability_raw']}. Language: {r['language_notes']}. "
        f"Sources: {r['source']} (verified {r['last_verified']})."
    )


class Retriever:
    def __init__(self) -> None:
        self.chunks: list[Chunk] = []
        for state, row in load_states().iterrows():
            self.chunks.append(
                Chunk(
                    f"{STATE_SOURCE}#{state}",
                    STATE_SOURCE,
                    _state_text(state, row),
                    title=f"State Profile: {state}",
                    source_url="",
                    last_verified=str(row["last_verified"]),
                    status="official",
                )
            )

        # 1. Load corpus/*.md files (16 seeded documents)
        corpus_dir = DATA_DIR / "corpus"
        if corpus_dir.exists():
            for path in sorted(corpus_dir.glob("*.md")):
                meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
                doc_id = meta.get("id", path.stem)
                title = meta.get("title", doc_id)
                source_url = meta.get("source_url", "")
                last_verified = meta.get("last_verified", "UNVERIFIED")
                status = meta.get("status", "starter-summary")
                authority = meta.get("authority", "")

                for i, c in enumerate(_chunk_text(body), start=1):
                    self.chunks.append(
                        Chunk(
                            chunk_id=f"{doc_id}#{i}",
                            source=doc_id,
                            text=c,
                            title=title,
                            source_url=source_url,
                            last_verified=last_verified,
                            status=status,
                            authority=authority,
                        )
                    )

        # 2. Also load docs/* if present
        docs_dir = DATA_DIR / "docs"
        if docs_dir.exists():
            for path in sorted(docs_dir.glob("*")):
                if path.suffix.lower() not in {".md", ".txt"}:
                    continue
                meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
                doc_id = meta.get("id", path.stem)
                for i, c in enumerate(_chunk_text(body), start=1):
                    self.chunks.append(
                        Chunk(
                            chunk_id=f"{doc_id}#{i}",
                            source=doc_id,
                            text=c,
                            title=meta.get("title", doc_id),
                            source_url=meta.get("source_url", ""),
                            last_verified=meta.get("last_verified", "UNVERIFIED"),
                            status=meta.get("status", "starter-summary"),
                            authority=meta.get("authority", ""),
                        )
                    )

        self.vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self.matrix = self.vec.fit_transform([c.text for c in self.chunks])

    def state_chunk(self, state: str) -> Chunk | None:
        cid = f"{STATE_SOURCE}#{state}"
        return next((c for c in self.chunks if c.chunk_id.lower() == cid.lower()), None)

    def search(self, query: str, k: int = 5) -> list[Chunk]:
        sims = cosine_similarity(self.vec.transform([query]), self.matrix).ravel()
        top = sims.argsort()[::-1][:k]
        return [
            Chunk(
                chunk_id=self.chunks[i].chunk_id,
                source=self.chunks[i].source,
                text=self.chunks[i].text,
                title=self.chunks[i].title,
                source_url=self.chunks[i].source_url,
                last_verified=self.chunks[i].last_verified,
                status=self.chunks[i].status,
                authority=self.chunks[i].authority,
                score=float(sims[i]),
            )
            for i in top
            if sims[i] >= MIN_SIMILARITY
        ]


@lru_cache(maxsize=1)
def get_retriever() -> Retriever:
    return Retriever()
