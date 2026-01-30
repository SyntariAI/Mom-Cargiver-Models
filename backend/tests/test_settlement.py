import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Caregiver, PayPeriod, TimeEntry, Expense, Settlement, PeriodStatus
from app.models.expense import Payer, ExpenseCategory
from app.services.settlement_calculator import calculate_settlement


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_calculate_settlement_rafi_owes_adi(db_session):
    """Test when Adi pays more than Rafi, so Rafi owes Adi."""
    # Setup: Create caregiver and period
    caregiver = Caregiver(name="Julia", default_hourly_rate=15)
    db_session.add(caregiver)

    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    # Julia worked 48 hours = $720
    entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=caregiver.id,
        date=date(2026, 1, 15),
        hours=Decimal("48"),
        hourly_rate=Decimal("15"),
        total_pay=Decimal("720")
    )
    db_session.add(entry)

    # Adi paid Julia $720 + $100 groceries = $820 total
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Julia payment",
        amount=Decimal("720"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.CAREGIVER_PAYMENT
    ))
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 16),
        description="Groceries",
        amount=Decimal("100"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.GROCERIES
    ))

    # Rafi paid $200 rent
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Rent",
        amount=Decimal("200"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.RENT
    ))
    db_session.commit()

    # Total expenses: $720 + $100 + $200 = $1020
    # Fair share: $510 each
    # Adi paid: $820, Rafi paid: $200
    # Adi overpaid by $310, so Rafi owes Adi $310

    result = calculate_settlement(db_session, period.id)

    assert result.total_caregiver_cost == Decimal("720")
    assert result.total_expenses == Decimal("1020")
    assert result.adi_paid == Decimal("820")
    assert result.rafi_paid == Decimal("200")
    assert result.settlement_direction.value == "rafi_owes_adi"
    assert result.settlement_amount == Decimal("310")
    assert result.final_amount == Decimal("310")


def test_calculate_settlement_adi_owes_rafi(db_session):
    """Test when Rafi pays more than Adi, so Adi owes Rafi."""
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    # Rafi paid $800 rent
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Rent",
        amount=Decimal("800"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.RENT
    ))

    # Adi paid $200 groceries
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 16),
        description="Groceries",
        amount=Decimal("200"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.GROCERIES
    ))
    db_session.commit()

    # Total: $1000, fair share: $500 each
    # Rafi paid $800, Adi paid $200
    # Rafi overpaid by $300, so Adi owes Rafi $300

    result = calculate_settlement(db_session, period.id)

    assert result.settlement_direction.value == "adi_owes_rafi"
    assert result.settlement_amount == Decimal("300")


def test_calculate_settlement_even(db_session):
    """Test when both pay exactly equal amounts."""
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Rent",
        amount=Decimal("500"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.RENT
    ))
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 16),
        description="Utilities",
        amount=Decimal("500"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.UTILITIES
    ))
    db_session.commit()

    result = calculate_settlement(db_session, period.id)

    assert result.settlement_direction.value == "even"
    assert result.settlement_amount == Decimal("0")
