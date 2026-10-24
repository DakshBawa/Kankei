"""Landed-cost engine driven by data/hs_duties.csv.

Duty cascade (standard Indian customs):
    AV   = CIF * (1 + landing_charge%)
    BCD  = AV * bcd%
    SWS  = BCD * sws%          (Social Welfare Surcharge, a % *of the BCD amount*)
    IGST = (AV + BCD + SWS) * igst%
The `effective_duty` column in the CSV is NOT used for calculation (it disagrees with the cascade
for several rows - see /comply/hs/audit); it is only used as a cross-check.
"""
import re
from functools import lru_cache

import pandas as pd

from app.config import DATA_DIR
from app.schemas import CostLine, LandedCostRequest, LandedCostResponse


class HSCodeError(ValueError):
    def __init__(self, msg: str, status: int = 404):
        super().__init__(msg)
        self.status = status


def _num(s) -> float:
    m = re.search(r"-?\d+(?:\.\d+)?", str(s))
    return float(m.group()) if m else 0.0


def _sws_pct_of_bcd(s) -> float:
    return _num(s) if "on bcd" in str(s).lower() else 0.0


def cascade_pct(bcd: float, sws_of_bcd: float, igst: float) -> float:
    """Effective duty as % of assessable value."""
    b, i = bcd / 100, igst / 100
    return ((1 + b + b * sws_of_bcd / 100) * (1 + i) - 1) * 100


@lru_cache(maxsize=1)
def load_duties() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / "hs_duties.csv", dtype=str)
    df["hs_digits"] = df["hs_code"].str.replace(r"\D", "", regex=True)
    df["bcd_pct"] = df["bcd_rate"].map(_num)
    df["sws_pct_of_bcd"] = df["sws_rate"].map(_sws_pct_of_bcd)
    df["igst_pct"] = df["igst_rate"].map(_num)
    df["csv_effective_pct"] = df["effective_duty"].map(_num)
    return df


def lookup(code: str) -> pd.Series:
    digits = re.sub(r"\D", "", code)
    if len(digits) < 4:
        raise HSCodeError("HS code needs at least 4 digits", 422)
    df = load_duties()
    exact = df[df.hs_digits == digits]
    if len(exact) == 1:
        return exact.iloc[0]
    pre = df[df.hs_digits.str.startswith(digits)]
    if len(pre) == 1:
        return pre.iloc[0]
    if len(pre) == 0:
        raise HSCodeError(f"HS code {code} is not in the duty table ({len(df)} codes loaded)")
    raise HSCodeError(f"HS code {code} is ambiguous; candidates: {', '.join(pre.hs_code)}", 422)


def search(q: str) -> list[dict]:
    ql = q.lower().strip()
    df = load_duties()
    hit = df[df.description.str.lower().str.contains(ql, regex=False)
             | df.hs_digits.str.startswith(re.sub(r"\D", "", ql) or "\x00")]
    return hit[["hs_code", "description", "bcd_rate", "igst_rate", "verification_status", "source"]].to_dict("records")


def audit() -> list[dict]:
    """Compare the CSV's effective_duty with the cascade at the CSV's own rates."""
    rows = []
    for _, r in load_duties().iterrows():
        calc = round(cascade_pct(r.bcd_pct, r.sws_pct_of_bcd, r.igst_pct), 3)
        rows.append({"hs_code": r.hs_code, "csv_effective_duty_pct": r.csv_effective_pct,
                     "computed_effective_duty_pct": calc,
                     "matches": abs(calc - r.csv_effective_pct) < 0.05})
    return rows


def compute(req: LandedCostRequest) -> LandedCostResponse:
    row = lookup(req.hs_code)
    fx = 1.0 if req.currency == "INR" else float(req.fx_to_inr)
    cif = (req.goods_value + req.freight + req.insurance) * fx
    av = cif * (1 + req.landing_charge_pct / 100)

    bcd_pct = row.bcd_pct if req.bcd_override_pct is None else req.bcd_override_pct
    bcd = av * bcd_pct / 100
    sws = bcd * row.sws_pct_of_bcd / 100
    igst = (av + bcd + sws) * row.igst_pct / 100
    duty = bcd + sws + igst

    ref_calc = cascade_pct(row.bcd_pct, row.sws_pct_of_bcd, row.igst_pct)
    matches = abs(ref_calc - row.csv_effective_pct) < 0.05

    notes = [
        "IGST is normally creditable as input tax credit for a GST-registered importer; "
        "`landed_cost_excl_igst_inr` is the cost base in that case.",
        "Goods of Japanese origin may qualify for a preferential BCD under the India-Japan CEPA with a valid "
        "certificate of origin. Confirm eligibility and pass `bcd_override_pct` to model it.",
        f"Duty rates are marked '{row.verification_status}' (source: {row.source}). "
        "Confirm against the current CBIC tariff / with a customs broker before quoting.",
    ]
    if req.bcd_override_pct is not None:
        notes.append(f"BCD overridden to {req.bcd_override_pct}% (table rate: {row.bcd_pct}%).")
    if not matches:
        notes.append(
            f"Data warning: hs_duties.csv lists effective duty {row.csv_effective_pct}% but the BCD->SWS->IGST "
            f"cascade at the table's own rates gives {ref_calc:.2f}%. Calculated figures are used here."
        )

    r2 = lambda x: round(x, 2)
    return LandedCostResponse(
        hs_code=row.hs_code, description=row.description, cif_inr=r2(cif), assessable_value_inr=r2(av),
        lines=[
            CostLine(label="Basic Customs Duty (BCD)", amount_inr=r2(bcd), basis=f"{bcd_pct}% of assessable value"),
            CostLine(label="Social Welfare Surcharge (SWS)", amount_inr=r2(sws),
                     basis=f"{row.sws_pct_of_bcd}% of BCD"),
            CostLine(label="IGST", amount_inr=r2(igst), basis=f"{row.igst_pct}% of (AV + BCD + SWS)"),
        ],
        total_duty_inr=r2(duty), landed_cost_inr=r2(av + duty), landed_cost_excl_igst_inr=r2(av + bcd + sws),
        effective_duty_pct_of_av=round(duty / av * 100, 3), gst_rate_pct=row.igst_pct,
        reference_effective_duty_pct=row.csv_effective_pct, computed_reference_duty_pct=round(ref_calc, 3),
        matches_reference=matches, verification_status=row.verification_status, source=row.source, notes=notes,
    )
