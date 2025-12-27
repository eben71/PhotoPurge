from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app

client = TestClient(app)


def test_healthz():
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_loads_from_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://example:example@localhost:5432/example")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6380/0")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

    settings = Settings()

    assert settings.database_url == "postgresql://example:example@localhost:5432/example"
    assert settings.redis_url == "redis://localhost:6380/0"
    assert settings.cors_origins == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
