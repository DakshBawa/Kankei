"""Price waterfall: Japanese FOB price -> shelf price in India, step by step."""
from app.modules.comply import landed_cost
from app.schemas import (
    ChannelTier, LandedCostRequest, PriceWaterfallRequest, PriceWaterfallResponse, WaterfallStep,
)

# Default channel markups are ASSUMPTIONS (markup over each tier's purchase price). Replace with
# quotes from real partners.
DEFAULT_TIERS = {
    "B2B": [ChannelTier(name="Distributor", markup_pct=15)],
    "B2C": [ChannelTier(name="Distributor", markup_pct=15), ChannelTier(name="Retailer", markup_pct=25)],
}


def build(req: PriceWaterfallRequest) -> PriceWaterfallResponse:
    lc = landed_cost.compute(LandedCostRequest(
        hs_code=req.hs_code, goods_value=req.unit_price, currency=req.currency, fx_to_inr=req.fx_to_inr,
        freight=req.freight_per_unit, insurance=req.insurance_per_unit,
        landing_charge_pct=req.landing_charge_pct, bcd_override_pct=req.bcd_override_pct,
    ))
    fx = 1.0 if req.currency == "INR" else req.fx_to_inr
    tiers = req.tiers if req.tiers is not None else DEFAULT_TIERS[req.business_model]

    steps: list[WaterfallStep] = []
    cum = 0.0

    def add(label, kind, delta):
        nonlocal cum
        cum += delta
        steps.append(WaterfallStep(label=label, kind=kind, delta_inr=round(delta, 2),
                                   cumulative_inr=round(cum, 2)))

    add("FOB price (Japan)", "base", req.unit_price * fx)
    if req.freight_per_unit or req.insurance_per_unit:
        add("Freight + insurance", "cost", (req.freight_per_unit + req.insurance_per_unit) * fx)
    add("Landing charge (valuation)", "cost", lc.assessable_value_inr - lc.cif_inr)
    bcd, sws, _igst = lc.lines
    add("Basic Customs Duty", "duty", bcd.amount_inr)
    add("Social Welfare Surcharge", "duty", sws.amount_inr)
    landed_excl_igst = cum

    price = landed_excl_igst
    for t in tiers:
        add(f"{t.name} margin ({t.markup_pct:g}%)", "margin", price * t.markup_pct / 100)
        price = cum
    price_ex_gst = cum
    gst = price_ex_gst * lc.gst_rate_pct / 100
    add(f"GST ({lc.gst_rate_pct:g}%)", "tax", gst)
    add("Price to end customer", "total", 0.0)

    gap = headroom = None
    if req.competitor_price_inr:
        gap = round((price_ex_gst / req.competitor_price_inr - 1) * 100, 1)
        headroom = round((req.competitor_price_inr / landed_excl_igst - 1) * 100, 1)

    return PriceWaterfallResponse(
        steps=steps, landed_cost_inr=round(landed_excl_igst, 2), price_ex_gst_inr=round(price_ex_gst, 2),
        price_incl_gst_inr=round(price_ex_gst + gst, 2), gst_rate_pct=lc.gst_rate_pct,
        total_channel_markup_pct=round((price_ex_gst / landed_excl_igst - 1) * 100, 1),
        competitor_price_inr=req.competitor_price_inr, price_gap_pct=gap, markup_headroom_pct=headroom,
        assumptions=[
            "Importer is GST-registered and claims input credit on import IGST, so IGST is excluded from the cost base.",
            "Customs duty comes from hs_duties.csv (marked 'verify against CBIC'). Landing charge defaults to 1% of CIF.",
            ("Channel markups are user-supplied." if req.tiers is not None else
             "Channel markups are DEFAULT ASSUMPTIONS, not market data - replace with partner quotes."),
            "Domestic GST on resale is assumed equal to the table's IGST rate for this HS code.",
            "Currency conversion uses the fx_to_inr you supplied; no live rates are fetched.",
        ],
    )
