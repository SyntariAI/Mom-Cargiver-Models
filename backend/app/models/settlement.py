from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SettlementDirection(str, Enum):
    ADI_OWES_RAFI = "adi_owes_rafi"
    RAFI_OWES_ADI = "rafi_owes_adi"
    EVEN = "even"


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(
        ForeignKey("pay_periods.id"), unique=True
    )
    total_caregiver_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_expenses: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    adi_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    rafi_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settlement_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settlement_direction: Mapped[SettlementDirection] = mapped_column(String(20))
    carryover_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    final_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settled: Mapped[bool] = mapped_column(Boolean, default=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    pay_period = relationship("PayPeriod", backref="settlement")
