"""Load and normalise partners.csv into typed records."""
import re
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Optional

import pandas as pd

from app.config import DATA_DIR

TURNOVER_LOWER_BOUNDS = [10, 50, 100, 250, 500]  # INR crore, ascending


@dataclass(frozen=True)
class Partner:
    id: str
    name: str
    state: str
    sector: str
    type: str
    year_founded: int
    years_in_business: int
    directors_raw: str
    turnover_band: str
    turnover_rank: int          # 0 (smallest band) .. 4
    gst_pct: float
    litigation_count: int
    insolvency: bool
    adverse_media: Optional[str]  # None = clean, else the detail text
    brands: tuple[str, ...]
    japan_years: float
    japan_label: str
    language: str
    language_level: int         # 0 none, 1 basic EN, 2 fluent EN, 3 EN+basic JA, 4 business JA


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _turnover_rank(band: str) -> int:
    m = re.search(r"(\d+)", band.replace(",", ""))
    lower = int(m.group(1)) if m else 0
    return max((i for i, b in enumerate(TURNOVER_LOWER_BOUNDS) if lower >= b), default=0)


def _japan_years(s: str) -> float:
    if s.strip().lower().startswith("no"):
        return 0.0
    rng = re.search(r"(\d+)\s*-\s*(\d+)", s)
    if rng:
        return (int(rng.group(1)) + int(rng.group(2))) / 2
    one = re.search(r"(\d+)", s)
    return float(one.group(1)) if one else 0.0


def _language_level(s: str) -> int:
    t = s.lower()
    if "business japanese" in t:
        return 4
    if "japanese" in t:
        return 3
    if "fluent english" in t:
        return 2
    if "basic english" in t:
        return 1
    return 0


def _adverse(s: str) -> Optional[str]:
    if s.strip().lower().startswith("no"):
        return None
    m = re.search(r"\((.*)\)", s)
    return m.group(1) if m else s.strip()


@lru_cache(maxsize=1)
def load_partners() -> dict[str, Partner]:
    df = pd.read_csv(DATA_DIR / "partners.csv")
    year = date.today().year
    out: dict[str, Partner] = {}
    for _, r in df.iterrows():
        pid = slugify(r["name"])
        out[pid] = Partner(
            id=pid, name=r["name"], state=r["state"], sector=r["sector"], type=r["type"],
            year_founded=int(r["year founded"]), years_in_business=year - int(r["year founded"]),
            directors_raw=str(r["directors"]), turnover_band=r["turnover band"],
            turnover_rank=_turnover_rank(r["turnover band"]),
            gst_pct=float(r["GST filing regularity %"]), litigation_count=int(r["litigation count"]),
            insolvency=str(r["insolvency flag"]).strip().lower().startswith("yes"),
            adverse_media=_adverse(str(r["adverse-media flag"])),
            brands=tuple(b.strip() for b in str(r["brands handled"]).split(",") if b.strip()),
            japan_years=_japan_years(str(r["Japan-client experience"])),
            japan_label=str(r["Japan-client experience"]),
            language=str(r["Japanese/English capability"]),
            language_level=_language_level(str(r["Japanese/English capability"])),
        )
    return out
