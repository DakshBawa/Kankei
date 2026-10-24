from app.modules.match.data import load_partners
from app.modules.match.trust import trust_report


def _p(name):
    return next(p for p in load_partners().values() if p.name == name)


def test_trust_tiers_and_flags():
    good = trust_report(_p("Sakura Bharat Solutions Ltd"))
    assert good.tier == "A" and good.score > 90 and not good.flags
    bad = trust_report(_p("Trident Engineering Works"))
    assert bad.tier == "High risk" and any("Director" in f for f in bad.flags)
    weak = trust_report(_p("Zenith Enterprises India"))
    assert weak.tier == "C" and any("GST" in f for f in weak.flags)


def test_rank_excludes_high_risk_and_filters(client):
    body = {"profile": {"product_category": "industrial_sensors", "budget_usd": 250000}, "top_n": 50}
    names = [m["partner"]["name"] for m in client.post("/match/rank", json=body).json()["results"]]
    assert "Trident Engineering Works" not in names
    body["exclude_high_risk"] = False
    names = [m["partner"]["name"] for m in client.post("/match/rank", json=body).json()["results"]]
    assert "Trident Engineering Works" in names

    body.update(partner_types=["Distributor"], states=["Gujarat"])
    res = client.post("/match/rank", json=body).json()["results"]
    assert res and all(m["partner"]["type"] == "Distributor" and m["partner"]["state"] == "Gujarat" for m in res)


def test_competitor_conflict_penalised(client):
    base = {"profile": {"budget_usd": 250000}, "states": ["Gujarat"], "partner_types": ["Distributor"], "top_n": 50}
    def apex(body):
        return next(m for m in client.post("/match/rank", json=body).json()["results"]
                    if m["partner"]["name"].startswith("Apex"))
    clean = apex(base)
    flagged = apex({**base, "competitor_brands": ["RivalCorp"]})
    assert flagged["conflicts"] and not clean["conflicts"]
    assert flagged["match_score"] < clean["match_score"]


def test_partner_endpoints(client):
    assert len(client.get("/match/partners").json()) == 40
    assert client.get("/match/partners/sakura-bharat-solutions-ltd/trust").json()["tier"] == "A"
    assert client.get("/match/partners/nope/trust").status_code == 404
