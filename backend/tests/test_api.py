import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db


@pytest.fixture
def client():
    # Use in-memory database for tests
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_create_caregiver(client):
    response = client.post(
        "/api/caregivers",
        json={"name": "Julia", "default_hourly_rate": "15.00"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Julia"
    assert data["default_hourly_rate"] == "15.00"
    assert data["is_active"] is True
    assert "id" in data


def test_list_caregivers(client):
    client.post("/api/caregivers", json={"name": "Diana"})
    client.post("/api/caregivers", json={"name": "Edwina"})

    response = client.get("/api/caregivers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_caregiver(client):
    create_response = client.post("/api/caregivers", json={"name": "Margaret"})
    caregiver_id = create_response.json()["id"]

    response = client.get(f"/api/caregivers/{caregiver_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Margaret"


def test_update_caregiver(client):
    create_response = client.post(
        "/api/caregivers",
        json={"name": "Jemma", "default_hourly_rate": "15.00"}
    )
    caregiver_id = create_response.json()["id"]

    response = client.put(
        f"/api/caregivers/{caregiver_id}",
        json={"default_hourly_rate": "16.00"}
    )
    assert response.status_code == 200
    assert response.json()["default_hourly_rate"] == "16.00"


def test_deactivate_caregiver(client):
    create_response = client.post("/api/caregivers", json={"name": "Geraldine"})
    caregiver_id = create_response.json()["id"]

    response = client.delete(f"/api/caregivers/{caregiver_id}")
    assert response.status_code == 200

    # Verify deactivated
    get_response = client.get(f"/api/caregivers/{caregiver_id}")
    assert get_response.json()["is_active"] is False


def test_create_pay_period(client):
    response = client.post(
        "/api/pay-periods",
        json={
            "start_date": "2026-01-13",
            "end_date": "2026-01-26"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["start_date"] == "2026-01-13"
    assert data["end_date"] == "2026-01-26"
    assert data["status"] == "open"


def test_get_current_period(client):
    client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )

    response = client.get("/api/pay-periods/current")
    assert response.status_code == 200
    assert response.json()["status"] == "open"


def test_close_period(client):
    create_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = create_response.json()["id"]

    response = client.post(f"/api/pay-periods/{period_id}/close")
    assert response.status_code == 200
    assert response.json()["status"] == "closed"


def test_only_one_open_period(client):
    client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )

    response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-27", "end_date": "2026-02-09"}
    )
    assert response.status_code == 400
    assert "already an open period" in response.json()["detail"].lower()
