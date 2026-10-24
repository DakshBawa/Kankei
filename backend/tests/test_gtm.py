def test_waterfall_adds_up(client):
    body = {"hs_code": "9031.80.00", "unit_price": 10000, "currency": "JPY", "fx_to_inr": 0.55,
            "freight_per_unit": 500, "insurance_per_unit": 100, "business_model": "B2C",
            "competitor_price_inr": 9000}
    r = client.post("/gtm/price-waterfall", json=body).json()
    steps = r["steps"]
    assert abs(sum(s["delta_inr"] for s in steps) - steps[-1]["cumulative_inr"]) < 0.05
    assert steps[-1]["kind"] == "total" and steps[-1]["cumulative_inr"] == r["price_incl_gst_inr"]
    assert [s["label"] for s in steps if s["kind"] == "margin"][0].startswith("Distributor")
    # competitor comparison is internally consistent
    assert abs(r["price_gap_pct"] - (r["price_ex_gst_inr"] / 9000 - 1) * 100) < 0.1
    assert abs((1 + r["markup_headroom_pct"] / 100) * r["landed_cost_inr"] - 9000) < 0.5
    assert any("DEFAULT ASSUMPTIONS" in a for a in r["assumptions"])


def test_waterfall_custom_tiers_and_errors(client):
    body = {"hs_code": "8542.31.00", "unit_price": 1000, "tiers": [{"name": "Agent", "markup_pct": 10}]}
    r = client.post("/gtm/price-waterfall", json=body).json()
    assert r["total_channel_markup_pct"] == 10.0
    assert any("user-supplied" in a for a in r["assumptions"])
    assert client.post("/gtm/price-waterfall", json={**body, "hs_code": "0000"}).status_code == 404


def test_model_recommendation_reacts_to_inputs(client):
    small = client.post("/gtm/recommend-model", json={
        "profile": {"budget_usd": 60000}, "timeline_months": 6, "risk_tolerance": "low"}).json()
    assert small["results"][0]["model"] == "export_via_distributor"
    assert not next(m for m in small["results"] if m["model"] == "wholly_owned_subsidiary")["budget_ok"]
    big = client.post("/gtm/recommend-model", json={
        "profile": {"budget_usd": 5_000_000}, "timeline_months": 36, "risk_tolerance": "high",
        "control_need": "high", "local_manufacturing_required": True}).json()
    assert big["results"][0]["model"] == "wholly_owned_subsidiary"
