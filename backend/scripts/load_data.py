"""Load and embed corpus documents into pgvector.

Idempotent: updates existing chunks or inserts new ones.
Parses YAML front matter from backend/data/corpus/*.md and chunks by paragraph.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import yaml

# Path resolution: works from repo root or backend dir
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
CORPUS_DIR = BACKEND_DIR / "data" / "corpus"


def parse_front_matter(content: str) -> Tuple[Dict[str, Any], str]:
    """Extract YAML front matter and markdown body."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if not match:
        return {}, content
    yaml_text, body = match.group(1), match.group(2)
    try:
        meta = yaml.safe_load(yaml_text) or {}
    except Exception:
        meta = {}
    return meta, body


def chunk_body(body: str) -> List[str]:
    """Chunk markdown body by paragraphs."""
    paragraphs = re.split(r"\n\s*\n", body.strip())
    chunks = []
    for p in paragraphs:
        cleaned = p.strip()
        # Drop the starter summary warning note if it's a standalone chunk
        if not cleaned:
            continue
        chunks.append(cleaned)
    return chunks


def compute_embedding(text: str, dim: int = 128) -> List[float]:
    """Deterministic, lightweight embedding using feature hashing."""
    from sklearn.feature_extraction.text import HashingVectorizer
    vec = HashingVectorizer(n_features=dim, alternate_sign=False, norm="l2")
    sparse = vec.fit_transform([text])
    return sparse.toarray()[0].tolist()


def get_all_chunks() -> List[Dict[str, Any]]:
    chunks = []
    md_files = sorted(CORPUS_DIR.glob("*.md"))
    for md_path in md_files:
        content = md_path.read_text(encoding="utf-8")
        meta, body = parse_front_matter(content)
        doc_id = meta.get("id", md_path.stem)
        title = meta.get("title", doc_id)
        source_url = meta.get("source_url", "")
        last_verified = meta.get("last_verified", "UNVERIFIED")
        status = meta.get("status", "starter-summary")
        authority = meta.get("authority", "")

        body_chunks = chunk_body(body)
        for idx, text in enumerate(body_chunks, start=1):
            chunk_id = f"{doc_id}#{idx}"
            chunks.append({
                "chunk_id": chunk_id,
                "doc_id": doc_id,
                "title": title,
                "source_url": source_url,
                "last_verified": last_verified,
                "status": status,
                "authority": authority,
                "content": text,
            })
    return chunks


def load_into_pgvector() -> int:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        db_user = os.getenv("POSTGRES_USER", "kankei")
        db_pass = os.getenv("POSTGRES_PASSWORD", "kankei")
        db_host = os.getenv("POSTGRES_HOST", "localhost")
        db_port = os.getenv("POSTGRES_PORT", "5432")
        db_name = os.getenv("POSTGRES_DB", "kankei")
        database_url = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

    # Normalize url for psycopg
    if database_url.startswith("postgresql+psycopg://"):
        database_url = database_url.replace("postgresql+psycopg://", "postgresql://", 1)

    try:
        import psycopg
        from pgvector.psycopg import register_vector
    except ImportError:
        print("psycopg or pgvector not installed in python environment; skipping DB load.")
        return 0

    try:
        with psycopg.connect(database_url, connect_timeout=3) as conn:
            register_vector(conn)
            with conn.cursor() as cur:
                cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS corpus_chunks (
                        id SERIAL PRIMARY KEY,
                        chunk_id VARCHAR(100) UNIQUE NOT NULL,
                        doc_id VARCHAR(100) NOT NULL,
                        title TEXT NOT NULL,
                        source_url TEXT,
                        last_verified TEXT,
                        status TEXT,
                        authority TEXT,
                        content TEXT NOT NULL,
                        embedding vector(128)
                    );
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS corpus_chunks_chunk_id_idx ON corpus_chunks (chunk_id);")

                chunks = get_all_chunks()
                for c in chunks:
                    emb = compute_embedding(c["content"], 128)
                    cur.execute("""
                        INSERT INTO corpus_chunks (
                            chunk_id, doc_id, title, source_url, last_verified, status, authority, content, embedding
                        ) VALUES (
                            %(chunk_id)s, %(doc_id)s, %(title)s, %(source_url)s, %(last_verified)s, %(status)s, %(authority)s, %(content)s, %(embedding)s
                        )
                        ON CONFLICT (chunk_id) DO UPDATE SET
                            title = EXCLUDED.title,
                            source_url = EXCLUDED.source_url,
                            last_verified = EXCLUDED.last_verified,
                            status = EXCLUDED.status,
                            authority = EXCLUDED.authority,
                            content = EXCLUDED.content,
                            embedding = EXCLUDED.embedding;
                    """, {**c, "embedding": emb})

                conn.commit()
                print(f"Successfully loaded {len(chunks)} chunks into pgvector table 'corpus_chunks'.")
                return len(chunks)
    except Exception as e:
        print(f"PostgreSQL connection note: {e} (continuing with file-based RAG)")
        return 0


def main() -> int:
    chunks = get_all_chunks()
    print(f"Discovered {len(chunks)} chunks across {len(list(CORPUS_DIR.glob('*.md')))} corpus files.")
    load_into_pgvector()
    return 0


if __name__ == "__main__":
    sys.exit(main())
