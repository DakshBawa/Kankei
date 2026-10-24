def test_health(client):
    d = client.get("/health").json()["data"]
    assert d == {"states": 10, "states_last_verified": ["2024-10"], "partners": 40, "hs_codes": 8}
