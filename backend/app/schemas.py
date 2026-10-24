"""All request/response models, shared across modules."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

ProductCategory = Literal["industrial_sensors", "auto_components", "consumer_goods", "general"]
BusinessModel = Literal["B2B", "B2C"]
Factor = Literal[
    "demand", "cluster", "japan_presence", "logistics", "incentives",
    "cost", "talent", "ease_of_business", "power",
]
EntryModel = Literal[
    "export_via_distributor", "contract_manufacturing", "joint_venture", "wholly_owned_subsidiary"
]
PartnerType = Literal["Distributor", "Contract Manufacturer", "JV Candidate"]
Currency = Literal["INR", "JPY", "USD"]
Level = Literal["low", "medium", "high"]


class SMEProfile(BaseModel):
    product_category: ProductCategory = "general"
    business_model: BusinessModel = "B2B"
    budget_usd: float = Field(gt=0, description="Total market-entry budget in USD")
    # Optional overrides, e.g. {"cluster": 5, "cost": 1}. Missing keys use category defaults.
    priority_weights: dict[Factor, float] = Field(default_factory=dict)


class ScoreComponent(BaseModel):
    name: str
    score: float          # 0-1
    weight: float
    note: str = ""


# =============================================================== research
class FactorBreakdown(BaseModel):
    factor: Factor
    value: float          # normalised 0-1 input
    weight: float         # effective weight used
    contribution: float   # points this factor adds to the 0-100 score


class RankedState(BaseModel):
    rank: int
    state: str
    score: float
    factors: list[FactorBreakdown]
    top_factors: list[FactorBreakdown]  # top 3 contributors, for the UI's "why"
    language_notes: str = ""
    data_sources: str = ""
    last_verified: str = ""


class RankResponse(BaseModel):
    weights_used: dict[str, float]
    results: list[RankedState]


class BriefRequest(BaseModel):
    profile: SMEProfile
    state: Optional[str] = None  # defaults to the top-ranked state


class BriefContent(BaseModel):
    market_summary: str
    target_customers: list[str]
    competitors: list[str]
    risks: list[str]


class Citation(BaseModel):
    chunk_id: str
    source: str
    snippet: str
    title: Optional[str] = None
    source_url: Optional[str] = None
    last_verified: str = "UNVERIFIED"
    unverified: bool = True


class ExplainRequest(BaseModel):
    item_id: Optional[str] = None
    query: Optional[str] = None
    context: Optional[str] = None
    language: Literal["en", "ja"] = "en"


class ExplainResponse(BaseModel):
    explanation: str
    grounded: bool = True
    citations: list[Citation] = Field(default_factory=list)


class BriefResponse(BaseModel):
    state: str
    score: float
    top_factors: list[FactorBreakdown]
    ja: BriefContent
    en: BriefContent
    citations: list[Citation]


class AskRequest(BaseModel):
    question: str = Field(min_length=3)
    state: Optional[str] = None
    language: Literal["en", "ja"] = "en"


class AskResponse(BaseModel):
    answer: str
    grounded: bool  # False if the corpus had nothing relevant
    citations: list[Citation]


# ================================================================== match
class TrustReport(BaseModel):
    partner_id: str
    score: float                        # 0-100
    tier: Literal["A", "B", "C", "High risk"]
    components: list[ScoreComponent]
    flags: list[str]                    # human-readable red/amber flags


class PartnerSummary(BaseModel):
    partner_id: str
    name: str
    state: str
    sector: str
    type: PartnerType
    turnover_band: str
    years_in_business: int
    japan_client_experience: str
    language: str
    brands_handled: list[str]
    directors: str


class MatchRequest(BaseModel):
    profile: SMEProfile
    partner_types: list[PartnerType] = Field(default_factory=list, description="Empty = any")
    states: list[str] = Field(default_factory=list, description="Empty = any")
    competitor_brands: list[str] = Field(default_factory=list)
    language_need: Literal["any", "english", "japanese"] = "english"
    exclude_high_risk: bool = True
    min_trust: float = Field(default=0, ge=0, le=100)
    top_n: int = Field(default=10, ge=1, le=50)


class MatchedPartner(BaseModel):
    partner: PartnerSummary
    match_score: float                  # 0-100 blended fit + trust
    fit_score: float
    trust: TrustReport
    fit_components: list[ScoreComponent]
    state_opportunity_score: float
    conflicts: list[str]
    reasons: list[str]


class MatchResponse(BaseModel):
    considered: int
    results: list[MatchedPartner]


# ================================================================= comply
class LandedCostRequest(BaseModel):
    hs_code: str
    goods_value: float = Field(gt=0, description="FOB value in `currency`")
    currency: Currency = "INR"
    fx_to_inr: Optional[float] = Field(default=None, gt=0, description="INR per 1 unit of currency")
    freight: float = Field(default=0, ge=0)
    insurance: float = Field(default=0, ge=0)
    landing_charge_pct: float = Field(default=1.0, ge=0, description="% of CIF added to assessable value")
    bcd_override_pct: Optional[float] = Field(
        default=None, ge=0, le=100, description="Use a preferential BCD rate (e.g. under CEPA) once confirmed"
    )

    @model_validator(mode="after")
    def _fx_required(self):
        if self.currency != "INR" and not self.fx_to_inr:
            raise ValueError("fx_to_inr is required when currency is not INR")
        return self


class CostLine(BaseModel):
    label: str
    amount_inr: float
    basis: str


class LandedCostResponse(BaseModel):
    hs_code: str
    description: str
    cif_inr: float
    assessable_value_inr: float
    lines: list[CostLine]
    total_duty_inr: float                # BCD + SWS + IGST
    landed_cost_inr: float               # AV + all duties (IGST included)
    landed_cost_excl_igst_inr: float     # AV + BCD + SWS (the cost base if IGST is claimed back as ITC)
    effective_duty_pct_of_av: float
    gst_rate_pct: float
    reference_effective_duty_pct: Optional[float]   # value listed in hs_duties.csv
    computed_reference_duty_pct: float              # what the cascade gives at the table's own rates
    matches_reference: bool
    verification_status: str
    source: str
    notes: list[str]


class ChecklistRequest(BaseModel):
    entry_model: EntryModel
    product_category: ProductCategory = "general"
    business_model: BusinessModel = "B2B"
    hs_code: Optional[str] = None
    has_wireless: bool = False
    sold_prepackaged_retail: bool = False


class ChecklistItem(BaseModel):
    id: str
    title: str
    area: str
    authority: str
    phase: Literal["pre_entry", "setup", "import", "ongoing"]
    description: str
    action: str
    applicability: Literal["applies", "check"]
    verification: str
    source_hint: str


class ChecklistResponse(BaseModel):
    rules_status: str
    items: list[ChecklistItem]


# =================================================================== gtm
class ChannelTier(BaseModel):
    name: str
    markup_pct: float = Field(ge=0, description="Markup over this tier's purchase price")


class PriceWaterfallRequest(BaseModel):
    hs_code: str
    unit_price: float = Field(gt=0, description="FOB price per unit in `currency`")
    currency: Currency = "INR"
    fx_to_inr: Optional[float] = Field(default=None, gt=0)
    freight_per_unit: float = Field(default=0, ge=0)
    insurance_per_unit: float = Field(default=0, ge=0)
    landing_charge_pct: float = Field(default=1.0, ge=0)
    bcd_override_pct: Optional[float] = Field(default=None, ge=0, le=100)
    business_model: BusinessModel = "B2B"
    tiers: Optional[list[ChannelTier]] = Field(default=None, description="Omit to use default assumptions")
    competitor_price_inr: Optional[float] = Field(default=None, gt=0, description="Comparable price, ex-GST")

    @model_validator(mode="after")
    def _fx_required(self):
        if self.currency != "INR" and not self.fx_to_inr:
            raise ValueError("fx_to_inr is required when currency is not INR")
        return self


class WaterfallStep(BaseModel):
    label: str
    kind: Literal["base", "cost", "duty", "margin", "tax", "total"]
    delta_inr: float
    cumulative_inr: float


class PriceWaterfallResponse(BaseModel):
    steps: list[WaterfallStep]
    landed_cost_inr: float               # excl. IGST (assumes importer claims ITC)
    price_ex_gst_inr: float
    price_incl_gst_inr: float
    gst_rate_pct: float
    total_channel_markup_pct: float
    competitor_price_inr: Optional[float]
    price_gap_pct: Optional[float]       # + means we are dearer than the competitor
    markup_headroom_pct: Optional[float] # total channel markup that would exactly match the competitor
    assumptions: list[str]


class ModelRecommendRequest(BaseModel):
    profile: SMEProfile
    timeline_months: int = Field(default=12, ge=1, description="Target time to first sales")
    risk_tolerance: Level = "medium"
    control_need: Level = "medium"
    local_manufacturing_required: bool = False


class ModelOption(BaseModel):
    model: EntryModel
    partner_type: Optional[PartnerType]
    score: float
    budget_ok: bool
    indicative_min_budget_usd: int
    reasons: list[str]
    tradeoffs: list[str]


class ModelRecommendResponse(BaseModel):
    weights_used: dict[str, float]
    results: list[ModelOption]
    notes: list[str]


# =============================================================== culture
class PhraseCheckRequest(BaseModel):
    text: str = Field(min_length=2)


class PhraseHit(BaseModel):
    matched: str
    speaker: Literal["japanese", "indian"]
    perceived_by_listener: str
    actual_meaning: str


class CoachRequest(BaseModel):
    message: str = Field(min_length=3)
    direction: Literal["ja_to_in", "in_to_ja"] = "ja_to_in"
    context: Optional[str] = Field(default=None, description="Who is talking to whom and why")
    language: Literal["en", "ja"] = "en"   # language of the explanations


class CoachRisk(BaseModel):
    dimension: str
    issue: str
    why: str


class CoachResponse(BaseModel):
    phrase_hits: list[PhraseHit]
    risks: list[CoachRisk]
    rewritten_message: str
    delivery_tips: list[str]
