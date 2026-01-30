from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus


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
