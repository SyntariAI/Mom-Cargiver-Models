import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db, import_models

# Import models BEFORE importing app to ensure they're registered with Base
import_models()

from app.main import app


@pytest.fixture
def client():
    # Use in-memory database for tests with StaticPool to share connection
    # SQLite in-memory databases are connection-scoped, so we need StaticPool
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
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


def test_create_time_entry(client):
    # Setup: create caregiver and period
    cg_response = client.post("/api/caregivers", json={"name": "Julia"})
    caregiver_id = cg_response.json()["id"]

    period_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = period_response.json()["id"]

    # Create time entry
    response = client.post(
        "/api/time-entries",
        json={
            "caregiver_id": caregiver_id,
            "pay_period_id": period_id,
            "date": "2026-01-15",
            "hours": "12.00",
            "hourly_rate": "15.00"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["hours"] == "12.00"
    assert data["total_pay"] == "180.00"


def test_list_time_entries_by_period(client):
    cg = client.post("/api/caregivers", json={"name": "Diana"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    })
    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "hours": "10.00",
        "hourly_rate": "15.00"
    })

    response = client.get(f"/api/time-entries?period_id={period['id']}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_time_entry(client):
    cg = client.post("/api/caregivers", json={"name": "Edwina"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    entry = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    response = client.put(
        f"/api/time-entries/{entry['id']}",
        json={"hours": "10.00"}
    )
    assert response.status_code == 200
    assert response.json()["hours"] == "10.00"
    assert response.json()["total_pay"] == "150.00"


def test_delete_time_entry(client):
    cg = client.post("/api/caregivers", json={"name": "Margaret"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    entry = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    response = client.delete(f"/api/time-entries/{entry['id']}")
    assert response.status_code == 204

    get_response = client.get(f"/api/time-entries/{entry['id']}")
    assert get_response.status_code == 404


def test_create_expense(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    response = client.post(
        "/api/expenses",
        json={
            "pay_period_id": period["id"],
            "date": "2026-01-15",
            "description": "Walmart groceries",
            "amount": "209.71",
            "paid_by": "Rafi",
            "category": "Groceries"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == "Walmart groceries"
    assert data["amount"] == "209.71"
    assert data["paid_by"] == "Rafi"


def test_list_expenses_by_period(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Rent",
        "amount": "800.00",
        "paid_by": "Rafi",
        "category": "Rent"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "FPL",
        "amount": "164.14",
        "paid_by": "Rafi",
        "category": "Utilities"
    })

    response = client.get(f"/api/expenses?period_id={period['id']}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_expense_summary(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Rent",
        "amount": "800.00",
        "paid_by": "Rafi",
        "category": "Rent"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "Medical",
        "amount": "85.00",
        "paid_by": "Adi",
        "category": "Medical"
    })

    response = client.get(f"/api/expenses/summary?period_id={period['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["rafi_total"] == "800.00"
    assert data["adi_total"] == "85.00"


def test_get_settlement(client):
    # Setup period with data
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    cg = client.post("/api/caregivers", json={"name": "Julia"}).json()

    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "12.00",
        "hourly_rate": "15.00"
    })

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Julia payment",
        "amount": "180.00",
        "paid_by": "Adi",
        "category": "Caregiver Payment"
    })

    response = client.get(f"/api/settlements/{period['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_caregiver_cost"] == "180.00"
    assert data["adi_paid"] == "180.00"
    assert data["rafi_paid"] == "0.00"


def test_mark_settled(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Get settlement first (creates it)
    client.get(f"/api/settlements/{period['id']}")

    # Mark as settled
    response = client.post(
        f"/api/settlements/{period['id']}/mark-settled",
        json={"payment_method": "Venmo"}
    )
    assert response.status_code == 200
    assert response.json()["settled"] is True
    assert response.json()["payment_method"] == "Venmo"


def test_get_settlement_not_found(client):
    response = client.get("/api/settlements/9999")
    assert response.status_code == 404


# =============================================================================
# Task #36: Reopen period and unsettle endpoints
# =============================================================================

def test_reopen_closed_period(client):
    """Test reopening a closed pay period."""
    # Create and close a period
    create_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = create_response.json()["id"]

    client.post(f"/api/pay-periods/{period_id}/close")

    # Reopen it
    response = client.post(f"/api/pay-periods/{period_id}/reopen")
    assert response.status_code == 200
    assert response.json()["status"] == "open"


def test_reopen_already_open_period_fails(client):
    """Test that reopening an already open period returns an error."""
    create_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = create_response.json()["id"]

    response = client.post(f"/api/pay-periods/{period_id}/reopen")
    assert response.status_code == 400
    assert "already open" in response.json()["detail"].lower()


def test_reopen_period_not_found(client):
    """Test that reopening a non-existent period returns 404."""
    response = client.post("/api/pay-periods/9999/reopen")
    assert response.status_code == 404


def test_reopen_when_another_period_is_open_fails(client):
    """Test that reopening fails when there's already another open period."""
    # Create first period and close it
    period1 = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()
    client.post(f"/api/pay-periods/{period1['id']}/close")

    # Create second period (will be open)
    client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-27", "end_date": "2026-02-09"}
    )

    # Try to reopen first period - should fail
    response = client.post(f"/api/pay-periods/{period1['id']}/reopen")
    assert response.status_code == 400
    assert "already an open period" in response.json()["detail"].lower()


def test_reopen_settled_period_unsettles_it(client):
    """Test that reopening a settled period also unsettles it."""
    # Create period
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Get settlement (creates it)
    client.get(f"/api/settlements/{period['id']}")

    # Mark as settled
    client.post(
        f"/api/settlements/{period['id']}/mark-settled",
        json={"payment_method": "Venmo"}
    )

    # Close the period
    client.post(f"/api/pay-periods/{period['id']}/close")

    # Reopen the period
    response = client.post(f"/api/pay-periods/{period['id']}/reopen")
    assert response.status_code == 200
    assert response.json()["status"] == "open"

    # Check that settlement is now unsettled
    settlement = client.get(f"/api/settlements/{period['id']}").json()
    assert settlement["settled"] is False
    assert settlement["settled_at"] is None


def test_unsettle_settled_period(client):
    """Test unsettling a settled period."""
    # Create period
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Get settlement (creates it)
    client.get(f"/api/settlements/{period['id']}")

    # Mark as settled
    settled = client.post(
        f"/api/settlements/{period['id']}/mark-settled",
        json={"payment_method": "Venmo"}
    ).json()
    assert settled["settled"] is True
    assert settled["payment_method"] == "Venmo"

    # Unsettle
    response = client.post(f"/api/settlements/{period['id']}/unsettle")
    assert response.status_code == 200
    data = response.json()
    assert data["settled"] is False
    assert data["settled_at"] is None
    # Payment method should be retained
    assert data["payment_method"] == "Venmo"


def test_unsettle_not_settled_fails(client):
    """Test that unsettling a non-settled period returns an error."""
    # Create period
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Get settlement (creates it but it's not settled)
    client.get(f"/api/settlements/{period['id']}")

    # Try to unsettle
    response = client.post(f"/api/settlements/{period['id']}/unsettle")
    assert response.status_code == 400
    assert "not settled" in response.json()["detail"].lower()


def test_unsettle_no_settlement_fails(client):
    """Test that unsettling fails when there's no settlement for the period."""
    # Create period but don't create a settlement
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Try to unsettle (no settlement exists)
    response = client.post(f"/api/settlements/{period['id']}/unsettle")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_unsettle_period_not_found(client):
    """Test that unsettling a non-existent period returns 404."""
    response = client.post("/api/settlements/9999/unsettle")
    assert response.status_code == 404
