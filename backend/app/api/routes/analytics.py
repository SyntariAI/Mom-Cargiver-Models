"""Analytics endpoints for aggregated data."""

from datetime import date
from decimal import Decimal
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.time_entry import TimeEntry
from app.models.expense import Expense
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod
from app.models.settlement import Settlement
from app.schemas.analytics import (
    MonthlyTrend,
    CaregiverBreakdown,
    ExpenseCategoryBreakdown,
    AllTimeSummary,
    PeriodComparisonItem,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/monthly-trend", response_model=list[MonthlyTrend])
def get_monthly_trend(
    months: int = Query(12, ge=1, le=36),
    db: Session = Depends(get_db)
):
    """
    Return monthly totals for the specified number of months.

    - **months**: Number of months to include (default: 12, max: 36)
    """
    # Calculate the date range
    today = date.today()
    start_date = today - relativedelta(months=months - 1)
    start_date = start_date.replace(day=1)  # First of that month

    # Query time entries grouped by year-month
    time_entries_query = (
        db.query(
            extract('year', TimeEntry.date).label('year'),
            extract('month', TimeEntry.date).label('month'),
            func.sum(TimeEntry.total_pay).label('total_cost'),
            func.sum(TimeEntry.hours).label('total_hours')
        )
        .filter(TimeEntry.date >= start_date)
        .group_by(
            extract('year', TimeEntry.date),
            extract('month', TimeEntry.date)
        )
        .all()
    )

    # Query expenses grouped by year-month
    expenses_query = (
        db.query(
            extract('year', Expense.date).label('year'),
            extract('month', Expense.date).label('month'),
            func.sum(Expense.amount).label('total_amount')
        )
        .filter(Expense.date >= start_date)
        .group_by(
            extract('year', Expense.date),
            extract('month', Expense.date)
        )
        .all()
    )

    # Build lookup dictionaries
    time_data = {}
    for row in time_entries_query:
        key = f"{int(row.year)}-{int(row.month):02d}"
        time_data[key] = {
            'cost': Decimal(str(row.total_cost or 0)),
            'hours': Decimal(str(row.total_hours or 0))
        }

    expense_data = {}
    for row in expenses_query:
        key = f"{int(row.year)}-{int(row.month):02d}"
        expense_data[key] = Decimal(str(row.total_amount or 0))

    # Generate all months in range
    results = []
    current = start_date
    while current <= today:
        month_key = f"{current.year}-{current.month:02d}"
        time_info = time_data.get(month_key, {'cost': Decimal('0'), 'hours': Decimal('0')})
        expense_total = expense_data.get(month_key, Decimal('0'))

        results.append(MonthlyTrend(
            month=month_key,
            total_caregiver_cost=time_info['cost'],
            total_expenses=expense_total,
            total_hours=time_info['hours']
        ))
        current = current + relativedelta(months=1)

    return results


@router.get("/caregiver-breakdown", response_model=list[CaregiverBreakdown])
def get_caregiver_breakdown(
    period_id: int | None = Query(None, description="Filter by pay period ID"),
    db: Session = Depends(get_db)
):
    """
    Return aggregated stats per caregiver.

    - **period_id**: Optional pay period ID to filter by
    """
    query = (
        db.query(
            TimeEntry.caregiver_id,
            Caregiver.name.label('caregiver_name'),
            func.sum(TimeEntry.hours).label('total_hours'),
            func.sum(TimeEntry.total_pay).label('total_cost'),
            func.count(TimeEntry.id).label('entry_count')
        )
        .join(Caregiver, TimeEntry.caregiver_id == Caregiver.id)
    )

    if period_id:
        # Verify period exists
        period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pay period {period_id} not found"
            )
        query = query.filter(TimeEntry.pay_period_id == period_id)

    results = (
        query
        .group_by(TimeEntry.caregiver_id, Caregiver.name)
        .order_by(func.sum(TimeEntry.total_pay).desc())
        .all()
    )

    return [
        CaregiverBreakdown(
            caregiver_id=row.caregiver_id,
            caregiver_name=row.caregiver_name,
            total_hours=Decimal(str(row.total_hours or 0)),
            total_cost=Decimal(str(row.total_cost or 0)),
            entry_count=row.entry_count or 0
        )
        for row in results
    ]


@router.get("/expense-categories", response_model=list[ExpenseCategoryBreakdown])
def get_expense_categories(
    period_id: int | None = Query(None, description="Filter by pay period ID"),
    db: Session = Depends(get_db)
):
    """
    Return totals grouped by expense category.

    - **period_id**: Optional pay period ID to filter by
    """
    query = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label('total_amount'),
            func.count(Expense.id).label('expense_count')
        )
    )

    if period_id:
        # Verify period exists
        period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pay period {period_id} not found"
            )
        query = query.filter(Expense.pay_period_id == period_id)

    results = (
        query
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )

    return [
        ExpenseCategoryBreakdown(
            category=row.category.value if hasattr(row.category, 'value') else str(row.category),
            total_amount=Decimal(str(row.total_amount or 0)),
            expense_count=row.expense_count or 0
        )
        for row in results
    ]


@router.get("/all-time-summary", response_model=AllTimeSummary)
def get_all_time_summary(db: Session = Depends(get_db)):
    """
    Return cumulative all-time totals.
    """
    # Get total hours and caregiver cost
    time_totals = (
        db.query(
            func.sum(TimeEntry.hours).label('total_hours'),
            func.sum(TimeEntry.total_pay).label('total_cost')
        )
        .first()
    )

    # Get total expenses
    expense_total = (
        db.query(func.sum(Expense.amount).label('total'))
        .first()
    )

    # Get period count
    period_count = db.query(func.count(PayPeriod.id)).scalar() or 0

    total_hours = Decimal(str(time_totals.total_hours or 0))
    total_caregiver_cost = Decimal(str(time_totals.total_cost or 0))
    total_expenses = Decimal(str(expense_total.total or 0))

    # Calculate averages
    if period_count > 0:
        avg_hours = total_hours / period_count
        avg_cost = total_caregiver_cost / period_count
        avg_expenses = total_expenses / period_count
    else:
        avg_hours = Decimal('0')
        avg_cost = Decimal('0')
        avg_expenses = Decimal('0')

    return AllTimeSummary(
        total_hours=total_hours,
        total_caregiver_cost=total_caregiver_cost,
        total_expenses=total_expenses,
        period_count=period_count,
        avg_hours_per_period=avg_hours.quantize(Decimal('0.01')),
        avg_caregiver_cost_per_period=avg_cost.quantize(Decimal('0.01')),
        avg_expenses_per_period=avg_expenses.quantize(Decimal('0.01'))
    )


@router.get("/period-comparison", response_model=list[PeriodComparisonItem])
def get_period_comparison(
    ids: str = Query(..., description="Comma-separated list of period IDs (e.g., '1,2,3')"),
    db: Session = Depends(get_db)
):
    """
    Compare multiple periods side by side.

    - **ids**: Comma-separated list of period IDs to compare
    """
    # Parse IDs
    try:
        period_ids = [int(x.strip()) for x in ids.split(',') if x.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid period IDs. Expected comma-separated integers."
        )

    if not period_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one period ID is required."
        )

    # Get periods
    periods = db.query(PayPeriod).filter(PayPeriod.id.in_(period_ids)).all()
    found_ids = {p.id for p in periods}
    missing_ids = set(period_ids) - found_ids

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pay periods not found: {sorted(missing_ids)}"
        )

    results = []
    for period in periods:
        # Get time entry totals for this period
        time_totals = (
            db.query(
                func.sum(TimeEntry.hours).label('total_hours'),
                func.sum(TimeEntry.total_pay).label('total_cost')
            )
            .filter(TimeEntry.pay_period_id == period.id)
            .first()
        )

        # Get expense totals for this period
        expense_total = (
            db.query(func.sum(Expense.amount).label('total'))
            .filter(Expense.pay_period_id == period.id)
            .first()
        )

        # Get settlement for this period
        settlement = (
            db.query(Settlement)
            .filter(Settlement.pay_period_id == period.id)
            .first()
        )

        results.append(PeriodComparisonItem(
            id=period.id,
            start_date=period.start_date,
            end_date=period.end_date,
            total_hours=Decimal(str(time_totals.total_hours or 0)),
            total_caregiver_cost=Decimal(str(time_totals.total_cost or 0)),
            total_expenses=Decimal(str(expense_total.total or 0)),
            settlement_amount=settlement.final_amount if settlement else None,
            settlement_direction=(
                settlement.settlement_direction.value
                if settlement and hasattr(settlement.settlement_direction, 'value')
                else (str(settlement.settlement_direction) if settlement else None)
            )
        ))

    # Sort by start_date
    results.sort(key=lambda x: x.start_date)

    return results
