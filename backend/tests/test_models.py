import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.caregiver import Caregiver


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
    assert caregiver.default_hourly_rate == 15.00
    assert caregiver.is_active is True
    assert caregiver.created_at is not None
