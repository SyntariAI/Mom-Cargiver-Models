"""Tests for analytics endpoints."""

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
    """Set up test data for analytics tests."""
    # Create caregivers
    cg1 = client.post("/api/caregivers", json={"name": "Julia", "default_hourly_rate": "15.00"}).json()
    cg2 = client.post("/api/caregivers", json={"name": "Diana", "default_hourly_rate": "18.00"}).json()

    # Create pay period
    period1 = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Close first period to create second
    client.post(f"/api/pay-periods/{period1['id']}/close")

    period2 = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-27", "end_date": "2026-02-09"}
    ).json()

    # Create time entries for period 1
    client.post("/api/time-entries", json={
        "caregiver_id": cg1["id"],
        "pay_period_id": period1["id"],
        "date": "2026-01-15",
        "hours": "12.00",
        "hourly_rate": "15.00"
    })
    client.post("/api/time-entries", json={
        "caregiver_id": cg2["id"],
        "pay_period_id": period1["id"],
        "date": "2026-01-16",
        "hours": "8.00",
        "hourly_rate": "18.00"
    })

    # Create time entries for period 2
    client.post("/api/time-entries", json={
        "caregiver_id": cg1["id"],
        "pay_period_id": period2["id"],
        "date": "2026-01-28",
        "hours": "10.00",
        "hourly_rate": "15.00"
    })

    # Create expenses
    client.post("/api/expenses", json={
        "pay_period_id": period1["id"],
        "date": "2026-01-15",
        "description": "Rent",
        "amount": "800.00",
        "paid_by": "Rafi",
        "category": "Rent"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period1["id"],
        "date": "2026-01-16",
        "description": "Groceries",
        "amount": "200.00",
        "paid_by": "Adi",
        "category": "Groceries"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period2["id"],
        "date": "2026-01-28",
        "description": "Medical",
        "amount": "100.00",
        "paid_by": "Rafi",
        "category": "Medical"
    })

    return {
        "caregivers": [cg1, cg2],
        "periods": [period1, period2]
    }


class TestMonthlyTrend:
    def test_monthly_trend_empty(self, client):
        """Test monthly trend with no data."""
        response = client.get("/api/analytics/monthly-trend")
        assert response.status_code == 200
        data = response.json()
        # Should return months even with no data
        assert isinstance(data, list)
        # All totals should be zero when no data
        for month in data:
            assert month["total_caregiver_cost"] == "0"
            assert month["total_expenses"] == "0"
            assert month["total_hours"] == "0"

    def test_monthly_trend_with_data(self, client, setup_data):
        """Test monthly trend with data."""
        response = client.get("/api/analytics/monthly-trend")
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

        # Find January 2026
        jan_data = next((m for m in data if m["month"] == "2026-01"), None)
        assert jan_data is not None
        # Julia: 12h * $15 (period 1) + 10h * $15 (period 2, date is 2026-01-28) = $330
        # Diana: 8h * $18 = $144
        # Total: $330 + $144 = $474
        assert jan_data["total_caregiver_cost"] == "474.00"
        assert jan_data["total_hours"] == "30.00"  # 12 + 8 + 10


class TestCaregiverBreakdown:
    def test_caregiver_breakdown_empty(self, client):
        """Test caregiver breakdown with no data."""
        response = client.get("/api/analytics/caregiver-breakdown")
        assert response.status_code == 200
        assert response.json() == []

    def test_caregiver_breakdown_all(self, client, setup_data):
        """Test caregiver breakdown for all periods."""
        response = client.get("/api/analytics/caregiver-breakdown")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Find Julia's breakdown
        julia = next((c for c in data if c["caregiver_name"] == "Julia"), None)
        assert julia is not None
        assert julia["total_hours"] == "22.00"  # 12 + 10
        assert julia["total_cost"] == "330.00"  # 22 * 15
        assert julia["entry_count"] == 2

    def test_caregiver_breakdown_by_period(self, client, setup_data):
        """Test caregiver breakdown filtered by period."""
        period_id = setup_data["periods"][0]["id"]
        response = client.get(f"/api/analytics/caregiver-breakdown?period_id={period_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Both Julia and Diana have entries in period 1
        julia = next((c for c in data if c["caregiver_name"] == "Julia"), None)
        assert julia["total_hours"] == "12.00"
        assert julia["entry_count"] == 1

    def test_caregiver_breakdown_invalid_period(self, client):
        """Test caregiver breakdown with invalid period ID."""
        response = client.get("/api/analytics/caregiver-breakdown?period_id=9999")
        assert response.status_code == 404


class TestExpenseCategories:
    def test_expense_categories_empty(self, client):
        """Test expense categories with no data."""
        response = client.get("/api/analytics/expense-categories")
        assert response.status_code == 200
        assert response.json() == []

    def test_expense_categories_all(self, client, setup_data):
        """Test expense categories for all periods."""
        response = client.get("/api/analytics/expense-categories")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # Rent, Groceries, Medical

        categories = {c["category"]: c for c in data}
        assert categories["Rent"]["total_amount"] == "800.00"
        assert categories["Rent"]["expense_count"] == 1
        assert categories["Groceries"]["total_amount"] == "200.00"
        assert categories["Medical"]["total_amount"] == "100.00"

    def test_expense_categories_by_period(self, client, setup_data):
        """Test expense categories filtered by period."""
        period_id = setup_data["periods"][0]["id"]
        response = client.get(f"/api/analytics/expense-categories?period_id={period_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # Rent and Groceries in period 1

    def test_expense_categories_invalid_period(self, client):
        """Test expense categories with invalid period ID."""
        response = client.get("/api/analytics/expense-categories?period_id=9999")
        assert response.status_code == 404


class TestAllTimeSummary:
    def test_all_time_summary_empty(self, client):
        """Test all-time summary with no data."""
        response = client.get("/api/analytics/all-time-summary")
        assert response.status_code == 200
        data = response.json()
        assert data["total_hours"] == "0"
        assert data["total_caregiver_cost"] == "0"
        assert data["total_expenses"] == "0"
        assert data["period_count"] == 0
        assert data["avg_hours_per_period"] == "0.00"

    def test_all_time_summary_with_data(self, client, setup_data):
        """Test all-time summary with data."""
        response = client.get("/api/analytics/all-time-summary")
        assert response.status_code == 200
        data = response.json()

        # Total hours: Julia 22h + Diana 8h = 30h
        assert data["total_hours"] == "30.00"
        # Total caregiver cost: Julia $330 + Diana $144 = $474
        assert data["total_caregiver_cost"] == "474.00"
        # Total expenses: $800 + $200 + $100 = $1100
        assert data["total_expenses"] == "1100.00"
        assert data["period_count"] == 2
        # Averages
        assert data["avg_hours_per_period"] == "15.00"
        assert data["avg_caregiver_cost_per_period"] == "237.00"
        assert data["avg_expenses_per_period"] == "550.00"


class TestPeriodComparison:
    def test_period_comparison_single(self, client, setup_data):
        """Test comparison of single period."""
        period_id = setup_data["periods"][0]["id"]
        response = client.get(f"/api/analytics/period-comparison?ids={period_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == period_id
        assert data[0]["total_hours"] == "20.00"
        assert data[0]["total_caregiver_cost"] == "324.00"
        assert data[0]["total_expenses"] == "1000.00"

    def test_period_comparison_multiple(self, client, setup_data):
        """Test comparison of multiple periods."""
        period_ids = [p["id"] for p in setup_data["periods"]]
        response = client.get(f"/api/analytics/period-comparison?ids={period_ids[0]},{period_ids[1]}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Sorted by start_date
        assert data[0]["start_date"] == "2026-01-13"
        assert data[1]["start_date"] == "2026-01-27"

    def test_period_comparison_invalid_ids(self, client):
        """Test comparison with invalid ID format."""
        response = client.get("/api/analytics/period-comparison?ids=abc,def")
        assert response.status_code == 400

    def test_period_comparison_missing_ids(self, client):
        """Test comparison with missing period IDs."""
        response = client.get("/api/analytics/period-comparison?ids=9999")
        assert response.status_code == 404

    def test_period_comparison_empty_ids(self, client):
        """Test comparison with empty IDs."""
        response = client.get("/api/analytics/period-comparison?ids=")
        assert response.status_code == 400

    def test_period_comparison_partial_missing(self, client, setup_data):
        """Test comparison with some valid and some invalid IDs."""
        valid_id = setup_data["periods"][0]["id"]
        response = client.get(f"/api/analytics/period-comparison?ids={valid_id},9999")
        assert response.status_code == 404
