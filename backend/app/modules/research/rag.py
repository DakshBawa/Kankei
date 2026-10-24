"""Minimal RAG: TF-IDF retrieval over (a) one synthesised chunk per state built from
states_scores_comparison.csv and (b) any .md/.txt files dropped into data/docs/.
Swap `Retriever` internals for embeddings / a vector DB later; the interface stays the same."""
import re
from dataclasses import dataclass
from functools import lru_cache

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
    score: float = 0.0

    @property
    def is_state_chunk(self) -> bool:
        return self.source == STATE_SOURCE


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
            self.chunks.append(Chunk(f"{STATE_SOURCE}#{state}", STATE_SOURCE, _state_text(state, row)))
        for path in sorted((DATA_DIR / "docs").glob("*")):
            if path.suffix.lower() not in {".md", ".txt"}:
                continue
            for i, c in enumerate(_chunk_text(path.read_text(encoding="utf-8"))):
                self.chunks.append(Chunk(f"{path.name}#{i}", path.name, c))
        self.vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self.matrix = self.vec.fit_transform([c.text for c in self.chunks])

    def state_chunk(self, state: str) -> Chunk | None:
        cid = f"{STATE_SOURCE}#{state}"
        return next((c for c in self.chunks if c.chunk_id.lower() == cid.lower()), None)

    def search(self, query: str, k: int = 5) -> list[Chunk]:
        sims = cosine_similarity(self.vec.transform([query]), self.matrix).ravel()
        top = sims.argsort()[::-1][:k]
        return [
            Chunk(self.chunks[i].chunk_id, self.chunks[i].source, self.chunks[i].text, float(sims[i]))
            for i in top
            if sims[i] >= MIN_SIMILARITY
        ]


@lru_cache(maxsize=1)
def get_retriever() -> Retriever:
    return Retriever()
