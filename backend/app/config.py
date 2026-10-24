import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("DATA_DIR", BACKEND_DIR / "data"))
