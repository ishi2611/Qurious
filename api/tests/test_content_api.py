from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_questions_are_listed_in_order_with_previews():
    questions = client.get("/questions").json()
    assert [q["order"] for q in questions] == sorted(q["order"] for q in questions)
    enabled = {q["id"] for q in questions if q["enabled"]}
    assert enabled == {"entanglement_ftl", "quantum_teleportation"}
    assert all(q["preview"] for q in questions)


def test_concepts_are_listed_foundations_first():
    ids = [c["id"] for c in client.get("/concepts").json()]
    assert len(ids) == 31
    assert ids.index("qubit") < ids.index("entanglement") < ids.index("teleportation")


def test_path_for_a_question():
    res = client.post("/path", json={"question_id": "entanglement_ftl"})
    assert res.status_code == 200
    body = res.json()
    ids = [s["id"] for s in body["steps"]]
    assert ids[-1] == "no_signaling"
    assert ids[0] in {"classical_bits", "probability_basics"}
    assert all(s["authored"] for s in body["steps"])
    assert body["total_minutes"] == sum(s["estimated_minutes"] for s in body["steps"])
    assert [s["is_target"] for s in body["steps"]].count(True) == 1


def test_known_concepts_shorten_the_path():
    full = client.post("/path", json={"question_id": "quantum_teleportation"}).json()["steps"]
    short = client.post(
        "/path", json={"question_id": "quantum_teleportation", "known": ["entanglement"]}
    ).json()["steps"]
    assert len(short) < len(full)
    assert "entanglement" not in [s["id"] for s in short]


def test_explicit_targets_work_without_a_question():
    res = client.post("/path", json={"targets": ["qubit"]})
    assert [s["id"] for s in res.json()["steps"]][-1] == "qubit"


def test_bad_requests_get_clear_errors():
    assert client.post("/path", json={"question_id": "nope"}).status_code == 404
    assert client.post("/path", json={}).status_code == 422
    res = client.post("/path", json={"targets": ["warp_drive"]})
    assert res.status_code == 422 and "warp_drive" in res.json()["detail"]
