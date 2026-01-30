import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.expense import Payer, ExpenseCategory


class ExpenseBase(BaseModel):
    date: datetime.date
    description: str
    amount: Decimal
    paid_by: Payer
    category: ExpenseCategory
    is_recurring: bool = False
    notes: str | None = None


class ExpenseCreate(ExpenseBase):
    pay_period_id: int | None = None

    @field_validator('amount')
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('amount must be positive')
        return v


class ExpenseUpdate(BaseModel):
    date: datetime.date | None = None
    description: str | None = None
    amount: Decimal | None = None
    paid_by: Payer | None = None
    category: ExpenseCategory | None = None
    is_recurring: bool | None = None
    notes: str | None = None


class ExpenseResponse(ExpenseBase):
    id: int
    pay_period_id: int
    date_estimated: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ExpenseSummary(BaseModel):
    adi_total: Decimal
    rafi_total: Decimal
    by_category: dict[str, Decimal]
