from datetime import date, time, datetime, timezone
from decimal import Decimal
from sqlalchemy import Date, Time, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(ForeignKey("pay_periods.id"))
    caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"))
    date: Mapped[date] = mapped_column(Date)
    time_in: Mapped[time | None] = mapped_column(Time, nullable=True)
    time_out: Mapped[time | None] = mapped_column(Time, nullable=True)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_pay: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    caregiver = relationship("Caregiver", backref="time_entries")
    pay_period = relationship("PayPeriod", backref="time_entries")
