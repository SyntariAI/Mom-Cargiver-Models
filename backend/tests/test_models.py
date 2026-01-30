from datetime import date, time
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus
from app.models.time_entry import TimeEntry
from app.models.expense import Expense, Payer, ExpenseCategory


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_caregiver(db_session):
    caregiver = Caregiver(
        name="Julia",
        default_hourly_rate=15.00,
        is_active=True
    )
    db_session.add(caregiver)
    db_session.commit()
    db_session.refresh(caregiver)

    assert caregiver.id is not None
    assert caregiver.name == "Julia"
    assert caregiver.default_hourly_rate == Decimal("15.00")
    assert caregiver.is_active is True
    assert caregiver.created_at is not None


def test_create_pay_period(db_session):
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    assert period.id is not None
    assert period.start_date == date(2026, 1, 13)
    assert period.end_date == date(2026, 1, 26)
    assert period.status == PeriodStatus.OPEN
    assert period.is_historical is False
    assert period.notes is None
    assert period.created_at is not None


def test_create_time_entry(db_session):
    # First create required foreign key records
    caregiver = Caregiver(name="Diana", default_hourly_rate=15.00)
    db_session.add(caregiver)

    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=caregiver.id,
        date=date(2026, 1, 15),
        time_in=time(19, 0),
        time_out=time(7, 0),
        hours=Decimal("12.00"),
        hourly_rate=Decimal("15.00"),
        total_pay=Decimal("180.00")
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    assert entry.id is not None
    assert entry.hours == Decimal("12.00")
    assert entry.total_pay == Decimal("180.00")
    assert entry.created_at is not None


def test_create_expense(db_session):
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    expense = Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Walmart groceries",
        amount=Decimal("209.71"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.GROCERIES
    )
    db_session.add(expense)
    db_session.commit()
    db_session.refresh(expense)

    assert expense.id is not None
    assert expense.amount == Decimal("209.71")
    assert expense.paid_by == Payer.RAFI
    assert expense.category == ExpenseCategory.GROCERIES
    assert expense.is_recurring is False
    assert expense.date_estimated is False
    assert expense.created_at is not None
