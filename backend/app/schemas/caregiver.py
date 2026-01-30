from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class CaregiverBase(BaseModel):
    name: str
    default_hourly_rate: Decimal = Decimal("15.00")
    is_active: bool = True


class CaregiverCreate(CaregiverBase):
    pass


class CaregiverUpdate(BaseModel):
    name: str | None = None
    default_hourly_rate: Decimal | None = None
    is_active: bool | None = None


class CaregiverResponse(CaregiverBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
