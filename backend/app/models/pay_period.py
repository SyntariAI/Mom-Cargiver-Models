from datetime import date, datetime, timezone
from enum import Enum
from sqlalchemy import String, Date, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PeriodStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class PayPeriod(Base):
    __tablename__ = "pay_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[PeriodStatus] = mapped_column(
        String(20), default=PeriodStatus.OPEN
    )
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
