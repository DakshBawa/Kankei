def _landed(client, **kw):
    body = {"hs_code": "9031.80.00", "goods_value": 100000, "landing_charge_pct": 0, **kw}
    return client.post("/comply/landed-cost", json=body)


def test_landed_cost_hand_calculated(client):
    # AV 100,000 | BCD 7.5% = 7,500 | SWS 10% of BCD = 750 | IGST 18% of 108,250 = 19,485
    r = _landed(client).json()
    assert [l["amount_inr"] for l in r["lines"]] == [7500.0, 750.0, 19485.0]
    assert r["total_duty_inr"] == 27735.0
    assert r["landed_cost_inr"] == 127735.0 and r["landed_cost_excl_igst_inr"] == 108250.0
    assert r["effective_duty_pct_of_av"] == 27.735
    assert r["matches_reference"] is False and r["reference_effective_duty_pct"] == 26.98


def test_zero_bcd_row_matches_reference(client):
    r = _landed(client, hs_code="8542.31.00").json()
    assert r["total_duty_inr"] == 18000.0 and r["matches_reference"] is True


def test_fx_landing_and_override(client):
    r = _landed(client, currency="JPY", fx_to_inr=0.55, goods_value=200000, landing_charge_pct=1,
                bcd_override_pct=0).json()
    assert r["cif_inr"] == 110000.0 and r["assessable_value_inr"] == 111100.0
    assert r["lines"][0]["amount_inr"] == 0.0 and r["lines"][2]["amount_inr"] == round(111100 * 0.18, 2)
    assert _landed(client, currency="JPY").status_code == 422  # fx missing


def test_hs_lookup_errors_and_prefix(client):
    assert _landed(client, hs_code="1234.56.78").status_code == 404
    assert _landed(client, hs_code="90").status_code == 422          # too short
    assert _landed(client, hs_code="9031").status_code == 200        # unique prefix
    assert _landed(client, hs_code="9025").status_code == 200
    assert client.get("/comply/hs", params={"q": "temperature"}).json()[0]["hs_code"] == "9025.19.20"


def test_audit_flags_known_mismatches(client):
    rows = client.get("/comply/hs/audit").json()
    assert sum(not r["matches"] for r in rows) == 5


def test_checklist_rules(client):
    base = {"entry_model": "export_via_distributor", "product_category": "industrial_sensors"}
    ids = lambda body: {i["id"]: i for i in client.post("/comply/checklist", json=body).json()["items"]}
    r = ids(base)
    assert "bis_crs_qco" in r and r["bis_crs_qco"]["applicability"] == "check"   # no HS code supplied
    assert "incorporation" not in r and "wpc_approval" not in r
    assert ids({**base, "hs_code": "9031.80.00"})["bis_crs_qco"]["applicability"] == "applies"
    assert "bis_crs_qco" not in ids({**base, "hs_code": "3004.90.00"})
    sub = ids({**base, "entry_model": "wholly_owned_subsidiary", "has_wireless": True})
    assert {"incorporation", "fdi_reporting", "wpc_approval"} <= sub.keys()
    assert all(i["verification"] == "unverified" for i in sub.values())
