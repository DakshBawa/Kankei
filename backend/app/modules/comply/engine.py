import re
from functools import lru_cache
from pathlib import Path

import yaml

from app.schemas import ChecklistItem, ChecklistRequest, ChecklistResponse

RULES_PATH = Path(__file__).parent / "rules.yaml"
PHASE_ORDER = {"pre_entry": 0, "setup": 1, "import": 2, "ongoing": 3}
REQUIRED = {"id", "title", "area", "authority", "phase", "description", "action", "applies_when"}


@lru_cache(maxsize=1)
def load_rules() -> dict:
    data = yaml.safe_load(RULES_PATH.read_text(encoding="utf-8"))
    for r in data["rules"]:
        missing = REQUIRED - r.keys()
        if missing:
            raise RuntimeError(f"rules.yaml rule {r.get('id')} missing {sorted(missing)}")
        if r["phase"] not in PHASE_ORDER:
            raise RuntimeError(f"rules.yaml rule {r['id']} has bad phase {r['phase']}")
    return data


def _match(cond: dict, req: ChecklistRequest) -> str | None:
    """Return None (rule does not apply), 'applies', or 'check' (applies if HS code matches)."""
    result = "applies"
    for key, want in (cond or {}).items():
        if key in ("entry_model", "product_category", "business_model"):
            if getattr(req, key) not in want:
                return None
        elif key == "wireless":
            if req.has_wireless != want:
                return None
        elif key == "prepackaged":
            if req.sold_prepackaged_retail != want:
                return None
        elif key == "hs_prefix":
            if req.hs_code:
                digits = re.sub(r"\D", "", req.hs_code)
                if not any(digits.startswith(p) for p in want):
                    return None
            else:
                result = "check"
        else:
            raise RuntimeError(f"Unknown applies_when key: {key}")
    return result


def evaluate(req: ChecklistRequest) -> ChecklistResponse:
    data = load_rules()
    items = []
    for r in data["rules"]:
        applic = _match(r["applies_when"], req)
        if applic is None:
            continue
        items.append(ChecklistItem(
            id=r["id"], title=r["title"], area=r["area"], authority=r["authority"], phase=r["phase"],
            description=r["description"], action=r["action"], applicability=applic,
            verification="unverified", source_hint=r.get("source_hint", ""),
        ))
    items.sort(key=lambda i: (PHASE_ORDER[i.phase], i.applicability != "applies"))
    return ChecklistResponse(rules_status=data["status"], items=items)


def build_roadmap(profile: dict | Any) -> ChecklistResponse:
    from app.schemas import ChecklistRequest
    if isinstance(profile, dict):
        cat = profile.get("product_category", "industrial_sensors")
        if cat == "sensors":
            cat = "industrial_sensors"
        intent = profile.get("ownership_intent", "distributor_first")
        if "distributor" in intent or profile.get("route") == "import":
            model = "export_via_distributor"
        elif "jv" in intent or "joint" in intent:
            model = "joint_venture"
        elif "subsidiary" in intent or "wholly" in intent:
            model = "wholly_owned_subsidiary"
        else:
            model = "export_via_distributor"
        req = ChecklistRequest(
            entry_model=model,
            product_category=cat if cat in ("industrial_sensors", "auto_components", "consumer_goods", "general") else "industrial_sensors",
            business_model=profile.get("customer_type", "B2B"),
            has_wireless=profile.get("has_wireless", False),
            sold_prepackaged_retail=profile.get("sold_prepackaged_retail", False),
        )
    else:
        req = ChecklistRequest(
            entry_model="export_via_distributor",
            product_category=getattr(profile, "product_category", "industrial_sensors"),
            business_model=getattr(profile, "business_model", "B2B"),
        )
    return evaluate(req)
