import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator


class TimeEntryBase(BaseModel):
    caregiver_id: int
    date: datetime.date
    time_in: datetime.time | None = None
    time_out: datetime.time | None = None
    hours: Decimal
    hourly_rate: Decimal
    notes: str | None = None


class TimeEntryCreate(TimeEntryBase):
    pay_period_id: int | None = None  # Will be inferred from date if not provided

    @field_validator('hours')
    @classmethod
    def hours_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('hours must be positive')
        if v > 24:
            raise ValueError('hours cannot exceed 24')
        return v


class TimeEntryUpdate(BaseModel):
    time_in: datetime.time | None = None
    time_out: datetime.time | None = None
    hours: Decimal | None = None
    hourly_rate: Decimal | None = None
    notes: str | None = None


class TimeEntryResponse(TimeEntryBase):
    id: int
    pay_period_id: int
    total_pay: Decimal
    created_at: datetime.datetime
    caregiver_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TimeEntryBulkCreate(BaseModel):
    entries: list[TimeEntryCreate]
