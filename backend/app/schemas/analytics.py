"""Analytics schemas for aggregated data endpoints."""

import datetime
from decimal import Decimal
from pydantic import BaseModel


class MonthlyTrend(BaseModel):
    """Monthly aggregated totals."""
    month: str  # Format: "YYYY-MM"
    total_caregiver_cost: Decimal
    total_expenses: Decimal
    total_hours: Decimal


class CaregiverBreakdown(BaseModel):
    """Aggregated stats per caregiver."""
    caregiver_id: int
    caregiver_name: str
    total_hours: Decimal
    total_cost: Decimal
    entry_count: int


class ExpenseCategoryBreakdown(BaseModel):
    """Totals grouped by expense category."""
    category: str
    total_amount: Decimal
    expense_count: int


class AllTimeSummary(BaseModel):
    """Cumulative all-time totals."""
    total_hours: Decimal
    total_caregiver_cost: Decimal
    total_expenses: Decimal
    period_count: int
    avg_hours_per_period: Decimal
    avg_caregiver_cost_per_period: Decimal
    avg_expenses_per_period: Decimal


class PeriodComparisonItem(BaseModel):
    """Single period data for comparison."""
    id: int
    start_date: datetime.date
    end_date: datetime.date
    total_hours: Decimal
    total_caregiver_cost: Decimal
    total_expenses: Decimal
    settlement_amount: Decimal | None
    settlement_direction: str | None
