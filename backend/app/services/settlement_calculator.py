from decimal import Decimal
from sqlalchemy.orm import Session

from app.models import TimeEntry, Expense, Settlement, PayPeriod
from app.models.expense import Payer
from app.models.settlement import SettlementDirection


def calculate_settlement(db: Session, period_id: int) -> Settlement:
    """
    Calculate the settlement for a pay period.

    Settlement formula:
    1. Total cost = sum of all expenses (caregiver payments are counted as expenses)
    2. Fair share = total cost / 2
    3. Settlement = who paid more - fair share
    """
    # Get all time entries for the period (for reporting total caregiver cost)
    time_entries = db.query(TimeEntry).filter(
        TimeEntry.pay_period_id == period_id
    ).all()

    # Get all expenses for the period
    expenses = db.query(Expense).filter(
        Expense.pay_period_id == period_id
    ).all()

    # Calculate totals
    total_caregiver_cost = sum(e.total_pay for e in time_entries)
    total_expenses = sum(e.amount for e in expenses)

    # What each person paid
    adi_paid = sum(e.amount for e in expenses if e.paid_by == Payer.ADI)
    rafi_paid = sum(e.amount for e in expenses if e.paid_by == Payer.RAFI)

    # Total cost is just the expenses (caregiver payments are logged as expenses)
    total_cost = total_expenses
    fair_share = total_cost / 2

    # Determine settlement
    if adi_paid > fair_share:
        settlement_amount = adi_paid - fair_share
        direction = SettlementDirection.RAFI_OWES_ADI
    elif rafi_paid > fair_share:
        settlement_amount = rafi_paid - fair_share
        direction = SettlementDirection.ADI_OWES_RAFI
    else:
        settlement_amount = Decimal("0")
        direction = SettlementDirection.EVEN

    # Round to 2 decimal places
    settlement_amount = settlement_amount.quantize(Decimal("0.01"))

    # Check for existing settlement
    existing = db.query(Settlement).filter(
        Settlement.pay_period_id == period_id
    ).first()

    if existing:
        # Update existing
        existing.total_caregiver_cost = total_caregiver_cost
        existing.total_expenses = total_expenses
        existing.adi_paid = adi_paid
        existing.rafi_paid = rafi_paid
        existing.settlement_amount = settlement_amount
        existing.settlement_direction = direction
        existing.final_amount = settlement_amount + existing.carryover_amount
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        settlement = Settlement(
            pay_period_id=period_id,
            total_caregiver_cost=total_caregiver_cost,
            total_expenses=total_expenses,
            adi_paid=adi_paid,
            rafi_paid=rafi_paid,
            settlement_amount=settlement_amount,
            settlement_direction=direction,
            carryover_amount=Decimal("0"),
            final_amount=settlement_amount
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)
        return settlement
