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
def setup_search_data(client):
    """Create data for search tests."""
    # Create caregivers
    julia = client.post("/api/caregivers", json={"name": "Julia"}).json()
    maria = client.post("/api/caregivers", json={"name": "Maria"}).json()

    # Create pay period
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Create time entries
    entry1 = client.post("/api/time-entries", json={
        "caregiver_id": julia["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00",
        "notes": "Morning shift coverage"
    }).json()

    entry2 = client.post("/api/time-entries", json={
        "caregiver_id": maria["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "hours": "12.00",
        "hourly_rate": "16.00",
        "notes": "Weekend overnight"
    }).json()

    # Create expenses
    expense1 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Walmart groceries",
        "amount": "150.00",
        "paid_by": "Rafi",
        "category": "Groceries"
    }).json()

    expense2 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "CVS medical supplies",
        "amount": "75.00",
        "paid_by": "Adi",
        "category": "Medical"
    }).json()

    expense3 = client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-17",
        "description": "Publix groceries",
        "amount": "200.00",
        "paid_by": "Rafi",
        "category": "Groceries"
    }).json()

    return {
        "caregivers": [julia, maria],
        "period": period,
        "time_entries": [entry1, entry2],
        "expenses": [expense1, expense2, expense3]
    }


def test_search_by_caregiver_name(client, setup_search_data):
    """Test searching for time entries by caregiver name."""
    response = client.get("/api/search?q=Julia")
    assert response.status_code == 200

    data = response.json()

    # Should find Julia in caregivers
    assert len(data["caregivers"]) == 1
    assert data["caregivers"][0]["name"] == "Julia"

    # Should find Julia's time entries
    assert len(data["time_entries"]) == 1
    assert data["time_entries"][0]["caregiver_name"] == "Julia"

    # No expenses with "Julia" in description
    assert len(data["expenses"]) == 0


def test_search_by_expense_description(client, setup_search_data):
    """Test searching for expenses by description."""
    response = client.get("/api/search?q=groceries")
    assert response.status_code == 200

    data = response.json()

    # Should find expenses with "groceries"
    assert len(data["expenses"]) == 2
    descriptions = [e["description"] for e in data["expenses"]]
    assert "Walmart groceries" in descriptions
    assert "Publix groceries" in descriptions

    # No caregivers with "groceries" in name
    assert len(data["caregivers"]) == 0


def test_search_by_time_entry_notes(client, setup_search_data):
    """Test searching for time entries by notes."""
    response = client.get("/api/search?q=morning")
    assert response.status_code == 200

    data = response.json()

    # Should find time entry with "morning" in notes
    assert len(data["time_entries"]) == 1
    assert "morning" in data["time_entries"][0]["notes"].lower()


def test_search_case_insensitive(client, setup_search_data):
    """Test that search is case insensitive."""
    # Search with lowercase
    response1 = client.get("/api/search?q=julia")
    assert response1.status_code == 200
    assert len(response1.json()["caregivers"]) == 1

    # Search with uppercase
    response2 = client.get("/api/search?q=JULIA")
    assert response2.status_code == 200
    assert len(response2.json()["caregivers"]) == 1

    # Search with mixed case
    response3 = client.get("/api/search?q=JuLiA")
    assert response3.status_code == 200
    assert len(response3.json()["caregivers"]) == 1


def test_search_partial_match(client, setup_search_data):
    """Test that search matches partial strings."""
    # Search for "Mar" should find "Maria"
    response = client.get("/api/search?q=Mar")
    assert response.status_code == 200

    data = response.json()
    assert len(data["caregivers"]) == 1
    assert data["caregivers"][0]["name"] == "Maria"


def test_search_no_results(client, setup_search_data):
    """Test search with no matching results."""
    response = client.get("/api/search?q=nonexistent")
    assert response.status_code == 200

    data = response.json()
    assert len(data["caregivers"]) == 0
    assert len(data["time_entries"]) == 0
    assert len(data["expenses"]) == 0


def test_search_requires_query(client, setup_search_data):
    """Test that search requires a query parameter."""
    response = client.get("/api/search")
    assert response.status_code == 422  # Validation error


def test_search_empty_query_rejected(client, setup_search_data):
    """Test that empty query is rejected."""
    response = client.get("/api/search?q=")
    assert response.status_code == 422  # Validation error - min_length=1


def test_search_multiple_entity_types(client, setup_search_data):
    """Test search that returns results from multiple entity types."""
    # Create an expense that mentions a caregiver name
    period_id = setup_search_data["period"]["id"]
    client.post("/api/expenses", json={
        "pay_period_id": period_id,
        "date": "2026-01-18",
        "description": "Payment to Julia",
        "amount": "180.00",
        "paid_by": "Adi",
        "category": "Caregiver Payment"
    })

    response = client.get("/api/search?q=Julia")
    assert response.status_code == 200

    data = response.json()

    # Should find Julia in caregivers
    assert len(data["caregivers"]) == 1

    # Should find Julia's time entries
    assert len(data["time_entries"]) == 1

    # Should find expense mentioning Julia
    assert len(data["expenses"]) == 1
    assert "Julia" in data["expenses"][0]["description"]


def test_search_medical_category(client, setup_search_data):
    """Test searching for medical expenses."""
    response = client.get("/api/search?q=medical")
    assert response.status_code == 200

    data = response.json()
    assert len(data["expenses"]) == 1
    assert "medical" in data["expenses"][0]["description"].lower()
