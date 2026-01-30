import datetime
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.pay_period import PeriodStatus


class PayPeriodBase(BaseModel):
    start_date: datetime.date
    end_date: datetime.date
    notes: str | None = None


class PayPeriodCreate(PayPeriodBase):
    @field_validator('end_date')
    @classmethod
    def end_date_must_be_after_start(cls, v, info):
        if 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class PayPeriodUpdate(BaseModel):
    notes: str | None = None


class PayPeriodResponse(PayPeriodBase):
    id: int
    status: PeriodStatus
    is_historical: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
