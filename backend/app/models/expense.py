from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, Date, Numeric, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Payer(str, Enum):
    ADI = "Adi"
    RAFI = "Rafi"


class ExpenseCategory(str, Enum):
    RENT = "Rent"
    UTILITIES = "Utilities"
    GROCERIES = "Groceries"
    MEDICAL = "Medical"
    CAREGIVER_PAYMENT = "Caregiver Payment"
    INSURANCE = "Insurance"
    SUPPLIES = "Supplies"
    OTHER = "Other"


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(ForeignKey("pay_periods.id"))
    date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    paid_by: Mapped[Payer] = mapped_column(String(10))
    category: Mapped[ExpenseCategory] = mapped_column(String(50))
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    date_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    pay_period = relationship("PayPeriod", backref="expenses")
