import json
import logging
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app import llm
from app.config import DATA_DIR
from app.schemas import CoachRequest, CoachResponse, CoachRisk, PhraseHit

log = logging.getLogger("kankei.culture")

PLAYBOOK_JSON = DATA_DIR / "culture_playbook.json"
LEGACY_PLAYBOOK_PATH = Path(__file__).parent / "playbook.json"


class PlaybookEntry(BaseModel):
    id: str
    direction: Literal["JP_to_IN", "IN_to_JP"]
    risk_level: str = "medium"
    pattern: str
    literal: str
    actual_intent: str
    coaching: str
    rewrite_en: str
    likely_read_by_indian_partner: Optional[str] = None
    likely_read_by_japanese_partner: Optional[str] = None

    @model_validator(mode="after")
    def validate_readings(self):
        if self.direction == "JP_to_IN":
            if not (self.likely_read_by_indian_partner and self.likely_read_by_indian_partner.strip()):
                raise ValueError(f"JP_to_IN entry {self.id} missing likely_read_by_indian_partner")
        elif self.direction == "IN_to_JP":
            if not (self.likely_read_by_japanese_partner and self.likely_read_by_japanese_partner.strip()):
                raise ValueError(f"IN_to_JP entry {self.id} missing likely_read_by_japanese_partner")
        return self


class PlaybookSchema(BaseModel):
    entries: list[PlaybookEntry]


# --------------------------------------------------------- Load & validate at startup
def _load_and_validate_playbook() -> tuple[dict, list[PlaybookEntry]]:
    if not PLAYBOOK_JSON.exists():
        raw = {"entries": []}
    else:
        raw = json.loads(PLAYBOOK_JSON.read_text(encoding="utf-8"))

    # Validate with Pydantic
    validated = PlaybookSchema(entries=raw.get("entries", []))

    # Also include legacy section_7 if present for backwards compatibility with tests
    if LEGACY_PLAYBOOK_PATH.exists():
        try:
            legacy = json.loads(LEGACY_PLAYBOOK_PATH.read_text(encoding="utf-8"))
            if "section_7" in legacy and "section_7" not in raw:
                raw["section_7"] = legacy["section_7"]
        except Exception:
            pass

    return raw, validated.entries


_PLAYBOOK_DATA, _VALIDATED_ENTRIES = _load_and_validate_playbook()


def load_playbook() -> dict:
    return _PLAYBOOK_DATA


def get_entries() -> list[PlaybookEntry]:
    return _VALIDATED_ENTRIES


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(ch for ch in s if not unicodedata.combining(ch)).replace("’", "'")


JA_ALIASES = {
    "jp-01": ["maemuki ni kento", "consider it positively", "前向きに検討"],
    "jp-02": ["zensho shimasu", "zensho suru", "handle it appropriately"],
    "jp-03": ["muzukashii desu ne", "difficult, isn't it", "難しい"],
    "jp-04": ["kento shimasu", "kentō shimasu", "we will consider it", "consider it"],
    "jp-05": ["mochikaette kakunin shimasu", "take this back and check"],
}
IN_ALIASES = {
    "in-01": ["it will be done", "it'll be done", "it is done", "no problem"],
    "in-02": ["we will try our best", "try our best"],
    "in-03": ["revert shortly", "i will revert"],
}


def _match_entries(text: str, direction: str) -> list[PlaybookEntry]:
    """Select entries whose pattern or alias appears in text (matching direction first)."""
    t_raw = text
    t_norm = _norm(text)

    matched_target = []

    for entry in _VALIDATED_ENTRIES:
        aliases = JA_ALIASES.get(entry.id, []) + IN_ALIASES.get(entry.id, [])
        patterns = [entry.pattern, entry.literal] + aliases

        matched = False
        for p in patterns:
            if not p:
                continue
            if p in t_raw or _norm(p) in t_norm:
                matched = True
                break

        if matched and entry.direction == direction:
            matched_target.append(entry)

    return matched_target


def check_phrases(text: str) -> list[PhraseHit]:
    """Deterministic phrase check used by /phrase-check endpoint."""
    t_raw = text
    t_norm = _norm(text)
    hits = []
    seen = set()

    for entry in _VALIDATED_ENTRIES:
        aliases = JA_ALIASES.get(entry.id, []) + IN_ALIASES.get(entry.id, [])
        patterns = [entry.pattern, entry.literal] + aliases

        matched_variant = None
        for p in patterns:
            if not p:
                continue
            if p in t_raw or _norm(p) in t_norm:
                matched_variant = p
                break

        if matched_variant and entry.pattern not in seen:
            seen.add(entry.pattern)
            speaker = "japanese" if entry.direction == "JP_to_IN" else "indian"
            perceived = (
                entry.likely_read_by_indian_partner if entry.direction == "JP_to_IN"
                else entry.likely_read_by_japanese_partner
            ) or ""
            hits.append(
                PhraseHit(
                    matched=matched_variant,
                    speaker=speaker,
                    perceived_by_listener=perceived,
                    actual_meaning=entry.actual_intent,
                )
            )
    return hits


class CoachLLMResult(BaseModel):
    risks: list[CoachRisk] = Field(default_factory=list)
    rewritten_message: str
    delivery_tips: list[str] = Field(default_factory=list)


def coach(
    text: Optional[str] = None,
    direction: str = "JP_to_IN",
    req: Optional[CoachRequest] = None,
    message: Optional[str] = None,
    context: Optional[str] = None,
    language: str = "en",
    **kwargs,
) -> CoachResponse:
    """Culture coach with deterministic fallback and cached LLM integration."""
    msg = text or message or (req.message if req else "")
    if req:
        raw_dir = req.direction
        ctx = req.context or context
        lang = req.language
    else:
        raw_dir = direction
        ctx = context
        lang = language

    # Normalize direction to JP_to_IN or IN_to_JP
    dir_str = str(raw_dir).lower()
    norm_dir = "IN_to_JP" if dir_str.startswith("in") else "JP_to_IN"

    matched = _match_entries(msg, norm_dir)
    hits = []
    seen = set()
    for e in matched:
        if e.pattern in seen:
            continue
        seen.add(e.pattern)
        speaker = "japanese" if e.direction == "JP_to_IN" else "indian"
        perceived = (
            e.likely_read_by_indian_partner if e.direction == "JP_to_IN"
            else e.likely_read_by_japanese_partner
        ) or ""
        hits.append(
            PhraseHit(
                matched=e.pattern,
                speaker=speaker,
                perceived_by_listener=perceived,
                actual_meaning=e.actual_intent,
            )
        )

    # ---------------- Deterministic Fallback Function ----------------
    def fallback() -> CoachLLMResult:
        if matched:
            primary = matched[0]
            risks = []
            for e in matched:
                dim = "High-Context & Indirect Communication" if e.direction == "JP_to_IN" else "Commitment & Feasibility"
                reading = e.likely_read_by_indian_partner if e.direction == "JP_to_IN" else e.likely_read_by_japanese_partner
                risks.append(
                    CoachRisk(
                        dimension=dim,
                        issue=f"Phrase: '{e.pattern}' (literal: '{e.literal}')",
                        why=f"Likely read by partner as: '{reading}'. Actual intent: '{e.actual_intent}'. Coaching: {e.coaching}",
                    )
                )
            return CoachLLMResult(
                risks=risks,
                rewritten_message=primary.rewrite_en,
                delivery_tips=[e.coaching for e in matched],
            )
        return CoachLLMResult(
            risks=[],
            rewritten_message=msg,
            delivery_tips=["Communicate with clear milestones, owners, and explicit confirmation."],
        )

    # Clean, deterministic prompt: no timestamps, sorted entries
    prompt_entries = [
        {
            "id": e.id,
            "direction": e.direction,
            "pattern": e.pattern,
            "literal": e.literal,
            "actual_intent": e.actual_intent,
            "likely_read_by_partner": e.likely_read_by_indian_partner if e.direction == "JP_to_IN" else e.likely_read_by_japanese_partner,
            "coaching": e.coaching,
            "rewrite_en": e.rewrite_en,
        }
        for e in matched
    ]

    system = (
        "You are a cross-cultural communication coach for Japan-India business. "
        "Analyze the message using only the provided playbook entries. "
        "Return JSON with: risks ([{dimension: str, issue: str, why: str}]), rewritten_message (str), delivery_tips ([str])."
    )
    user_prompt = (
        f"DIRECTION: {norm_dir}\n"
        f"CONTEXT: {ctx or 'General business communication'}\n"
        f"MESSAGE: {msg}\n"
        f"MATCHED_PLAYBOOK_ENTRIES: {json.dumps(prompt_entries, sort_keys=True, ensure_ascii=False)}"
    )

    try:
        raw_out = llm.complete_json(
            user_prompt,
            CoachLLMResult,
            system=system,
            fallback=fallback,
            use_cache=True,
        )
        if isinstance(raw_out, dict):
            llm_out = CoachLLMResult(**raw_out)
        elif isinstance(raw_out, CoachLLMResult):
            llm_out = raw_out
        else:
            llm_out = fallback()
    except Exception as exc:
        log.warning("LLM call failed or unavailable in coach, using deterministic fallback: %s", exc)
        llm_out = fallback()

    return CoachResponse(
        phrase_hits=hits,
        risks=llm_out.risks,
        rewritten_message=llm_out.rewritten_message,
        delivery_tips=llm_out.delivery_tips,
    )
