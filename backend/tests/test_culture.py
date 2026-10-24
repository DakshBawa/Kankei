def test_playbook_served(client):
    pb = client.get("/culture/playbook").json()
    assert len(pb["section_7"]["communication_dimensions"]) == 5


def test_phrase_check_hits_both_directions(client):
    hits = client.post("/culture/phrase-check", json={
        "text": "Thanks for the update. We will consider it. Also: it will be done by Friday."}).json()
    assert {h["speaker"] for h in hits} == {"japanese", "indian"}
    assert any("No" in h["actual_meaning"] for h in hits if h["speaker"] == "japanese")


def test_phrase_check_aliases_and_japanese_script(client):
    assert client.post("/culture/phrase-check", json={"text": "Kentō shimasu."}).json()
    assert client.post("/culture/phrase-check", json={"text": "前向きに検討します"}).json()
    assert client.post("/culture/phrase-check", json={"text": "Please send the invoice."}).json() == []


def test_coach_needs_llm(client):
    assert client.post("/culture/coach", json={"message": "We will consider it."}).status_code == 503
