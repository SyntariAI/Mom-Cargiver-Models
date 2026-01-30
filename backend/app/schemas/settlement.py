from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

from app.models.settlement import SettlementDirection


class SettlementResponse(BaseModel):
    id: int
    pay_period_id: int
    total_caregiver_cost: Decimal
    total_expenses: Decimal
    adi_paid: Decimal
    rafi_paid: Decimal
    settlement_amount: Decimal
    settlement_direction: SettlementDirection
    carryover_amount: Decimal
    final_amount: Decimal
    settled: bool
    settled_at: datetime | None
    payment_method: str | None

    model_config = ConfigDict(from_attributes=True)


class MarkSettledRequest(BaseModel):
    payment_method: str | None = None
