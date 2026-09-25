from fastapi.testclient import TestClient

from app import __version__
from app.main import app

client = TestClient(app)


def test_health_reports_ok_and_version():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "version": __version__}


def test_web_dev_server_is_allowed_by_cors():
    res = client.get("/health", headers={"Origin": "http://localhost:3000"})
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"
