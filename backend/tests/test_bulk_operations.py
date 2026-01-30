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
    """Create a test client with an in-memory database."""
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


@pytest.fixture
def setup_data(client):
    """Create base data for tests."""
    # Create caregiver
    cg = client.post("/api/caregivers", json={"name": "Julia"}).json()

    # Create pay period
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    return {"caregiver": cg, "period": period}


# =====================
# Time Entry Bulk Tests
# =====================

def test_bulk_delete_time_entries(client, setup_data):
    """Test deleting multiple time entries at once."""
    cg = setup_data["caregiver"]
    period = setup_data["period"]

    # Create multiple time entries
    entry1 = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    entry2 = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "hours": "10.00",
        "hourly_rate": "15.00"
    }).json()

    entry3 = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-17",
        "hours": "12.00",
        "hourly_rate": "15.00"
    }).json()

    # Bulk delete first two entries
    response = client.post(
        "/api/time-entries/bulk-delete",
        json={"ids": [entry1["id"], entry2["id"]]}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2

    # Verify deletion
    assert client.get(f"/api/time-entries/{entry1['id']}").status_code == 404
    assert client.get(f"/api/time-entries/{entry2['id']}").status_code == 404
    assert client.get(f"/api/time-entries/{entry3['id']}").status_code == 200


def test_bulk_delete_time_entries_empty_list(client, setup_data):
    """Test bulk delete with empty ID list."""
    response = client.post(
        "/api/time-entries/bulk-delete",
        json={"ids": []}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 0


def test_bulk_delete_time_entries_nonexistent_ids(client, setup_data):
    """Test bulk delete with non-existent IDs."""
    response = client.post(
        "/api/time-entries/bulk-delete",
        json={"ids": [9999, 9998, 9997]}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 0


def test_bulk_update_time_entries(client, setup_data):
    """Test updating multiple time entries at once."""
    cg = setup_data["caregiver"]
    period = setup_data["period"]

    # Create multiple time entries
    entry1 = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00",
        "notes": "Original notes"
    }).json()

    entry2 = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "hours": "10.00",
        "hourly_rate": "15.00"
    }).json()

    # Bulk update hourly rate
    response = client.post(
        "/api/time-entries/bulk-update",
        json={
            "ids": [entry1["id"], entry2["id"]],
            "updates": {"hourly_rate": "20.00"}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    # Verify updates
    updated1 = client.get(f"/api/time-entries/{entry1['id']}").json()
    updated2 = client.get(f"/api/time-entries/{entry2['id']}").json()

    assert updated1["hourly_rate"] == "20.00"
    assert updated1["total_pay"] == "160.00"  # 8 * 20
    assert updated2["hourly_rate"] == "20.00"
    assert updated2["total_pay"] == "200.00"  # 10 * 20


def test_bulk_update_time_entries_empty_list(client, setup_data):
    """Test bulk update with empty ID list."""
    response = client.post(
        "/api/time-entries/bulk-update",
        json={
            "ids": [],
            "updates": {"hourly_rate": "20.00"}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 0


def test_bulk_update_time_entries_no_updates(client, setup_data):
    """Test bulk update with no update fields."""
    cg = setup_data["caregiver"]
    period = setup_data["period"]

    entry = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    response = client.post(
        "/api/time-entries/bulk-update",
        json={
            "ids": [entry["id"]],
            "updates": {}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 0


# =====================
# Expense Bulk Tests
# =====================

def test_bulk_delete_expenses(client, setup_data):
    """Test deleting multiple expenses at once."""
    period = setup_data["period"]

    # Create multiple expenses
    expense1 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Groceries",
        "amount": "100.00",
        "paid_by": "Rafi",
        "category": "Groceries"
    }).json()

    expense2 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "Utilities",
        "amount": "150.00",
        "paid_by": "Adi",
        "category": "Utilities"
    }).json()

    expense3 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-17",
        "description": "Medical",
        "amount": "200.00",
        "paid_by": "Rafi",
        "category": "Medical"
    }).json()

    # Bulk delete first two expenses
    response = client.post(
        "/api/expenses/bulk-delete",
        json={"ids": [expense1["id"], expense2["id"]]}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 2

    # Verify deletion
    assert client.get(f"/api/expenses/{expense1['id']}").status_code == 404
    assert client.get(f"/api/expenses/{expense2['id']}").status_code == 404
    assert client.get(f"/api/expenses/{expense3['id']}").status_code == 200


def test_bulk_delete_expenses_empty_list(client, setup_data):
    """Test bulk delete with empty ID list."""
    response = client.post(
        "/api/expenses/bulk-delete",
        json={"ids": []}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 0


def test_bulk_delete_expenses_nonexistent_ids(client, setup_data):
    """Test bulk delete with non-existent IDs."""
    response = client.post(
        "/api/expenses/bulk-delete",
        json={"ids": [9999, 9998, 9997]}
    )
    assert response.status_code == 200
    assert response.json()["deleted_count"] == 0


def test_bulk_update_expenses(client, setup_data):
    """Test updating multiple expenses at once."""
    period = setup_data["period"]

    # Create multiple expenses
    expense1 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Groceries",
        "amount": "100.00",
        "paid_by": "Rafi",
        "category": "Groceries"
    }).json()

    expense2 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "More groceries",
        "amount": "150.00",
        "paid_by": "Adi",
        "category": "Groceries"
    }).json()

    # Bulk update to change paid_by
    response = client.post(
        "/api/expenses/bulk-update",
        json={
            "ids": [expense1["id"], expense2["id"]],
            "updates": {"paid_by": "Adi"}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    # Verify updates
    updated1 = client.get(f"/api/expenses/{expense1['id']}").json()
    updated2 = client.get(f"/api/expenses/{expense2['id']}").json()

    assert updated1["paid_by"] == "Adi"
    assert updated2["paid_by"] == "Adi"


def test_bulk_update_expenses_category(client, setup_data):
    """Test bulk updating expense category."""
    period = setup_data["period"]

    expense1 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Item 1",
        "amount": "50.00",
        "paid_by": "Rafi",
        "category": "Other"
    }).json()

    expense2 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "Item 2",
        "amount": "75.00",
        "paid_by": "Rafi",
        "category": "Other"
    }).json()

    # Bulk update category
    response = client.post(
        "/api/expenses/bulk-update",
        json={
            "ids": [expense1["id"], expense2["id"]],
            "updates": {"category": "Supplies"}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 2

    # Verify updates
    updated1 = client.get(f"/api/expenses/{expense1['id']}").json()
    updated2 = client.get(f"/api/expenses/{expense2['id']}").json()

    assert updated1["category"] == "Supplies"
    assert updated2["category"] == "Supplies"


def test_bulk_update_expenses_empty_list(client, setup_data):
    """Test bulk update with empty ID list."""
    response = client.post(
        "/api/expenses/bulk-update",
        json={
            "ids": [],
            "updates": {"paid_by": "Adi"}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 0


def test_bulk_update_expenses_no_updates(client, setup_data):
    """Test bulk update with no update fields."""
    period = setup_data["period"]

    expense = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Test",
        "amount": "100.00",
        "paid_by": "Rafi",
        "category": "Other"
    }).json()

    response = client.post(
        "/api/expenses/bulk-update",
        json={
            "ids": [expense["id"]],
            "updates": {}
        }
    )
    assert response.status_code == 200
    assert response.json()["updated_count"] == 0
