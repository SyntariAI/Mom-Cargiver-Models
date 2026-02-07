from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.time_entry import TimeEntry
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod
from app.schemas.time_entry import (
    TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse, TimeEntryBulkCreate
)


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class BulkDeleteResponse(BaseModel):
    deleted_count: int


class BulkUpdateRequest(BaseModel):
    ids: list[int]
    updates: TimeEntryUpdate


class BulkUpdateResponse(BaseModel):
    updated_count: int

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"])


def calculate_total_pay(hours: Decimal, hourly_rate: Decimal) -> Decimal:
    return (hours * hourly_rate).quantize(Decimal("0.01"))


@router.get("", response_model=list[TimeEntryResponse])
def list_time_entries(
    period_id: int | None = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(TimeEntry)
    if period_id:
        query = query.filter(TimeEntry.pay_period_id == period_id)
    entries = query.order_by(TimeEntry.date).all()

    # Add caregiver name to response
    result = []
    for entry in entries:
        entry_dict = TimeEntryResponse.model_validate(entry).model_dump()
        entry_dict["caregiver_name"] = entry.caregiver.name
        result.append(entry_dict)
    return result


@router.post("", response_model=TimeEntryResponse, status_code=status.HTTP_201_CREATED)
def create_time_entry(entry: TimeEntryCreate, db: Session = Depends(get_db)):
    # Verify caregiver exists
    caregiver = db.query(Caregiver).filter(Caregiver.id == entry.caregiver_id).first()
    if not caregiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found"
        )

    # Verify or find pay period
    if entry.pay_period_id:
        period = db.query(PayPeriod).filter(PayPeriod.id == entry.pay_period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pay period not found"
            )
    else:
        # Find period that contains this date
        period = db.query(PayPeriod).filter(
            PayPeriod.start_date <= entry.date,
            PayPeriod.end_date >= entry.date
        ).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No pay period found for date {entry.date}"
            )

    total_pay = calculate_total_pay(entry.hours, entry.hourly_rate)

    db_entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=entry.caregiver_id,
        date=entry.date,
        time_in=entry.time_in,
        time_out=entry.time_out,
        hours=entry.hours,
        hourly_rate=entry.hourly_rate,
        total_pay=total_pay,
        notes=entry.notes
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)

    response = TimeEntryResponse.model_validate(db_entry).model_dump()
    response["caregiver_name"] = caregiver.name
    return response


def _create_single_entry(entry: TimeEntryCreate, db: Session) -> TimeEntry:
    """Create a single time entry without committing. Used by both single and bulk create."""
    caregiver = db.query(Caregiver).filter(Caregiver.id == entry.caregiver_id).first()
    if not caregiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Caregiver {entry.caregiver_id} not found"
        )

    if entry.pay_period_id:
        period = db.query(PayPeriod).filter(PayPeriod.id == entry.pay_period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pay period not found"
            )
    else:
        period = db.query(PayPeriod).filter(
            PayPeriod.start_date <= entry.date,
            PayPeriod.end_date >= entry.date
        ).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No pay period found for date {entry.date}"
            )

    total_pay = calculate_total_pay(entry.hours, entry.hourly_rate)

    db_entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=entry.caregiver_id,
        date=entry.date,
        time_in=entry.time_in,
        time_out=entry.time_out,
        hours=entry.hours,
        hourly_rate=entry.hourly_rate,
        total_pay=total_pay,
        notes=entry.notes
    )
    db.add(db_entry)
    return db_entry


@router.post("/bulk", response_model=list[TimeEntryResponse], status_code=status.HTTP_201_CREATED)
def create_time_entries_bulk(bulk: TimeEntryBulkCreate, db: Session = Depends(get_db)):
    """Create multiple time entries atomically."""
    db_entries = []
    for entry_data in bulk.entries:
        db_entry = _create_single_entry(entry_data, db)
        db_entries.append(db_entry)

    db.commit()
    for entry in db_entries:
        db.refresh(entry)

    results = []
    for entry in db_entries:
        response = TimeEntryResponse.model_validate(entry).model_dump()
        response["caregiver_name"] = entry.caregiver.name
        results.append(response)
    return results


@router.get("/{entry_id}", response_model=TimeEntryResponse)
def get_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found"
        )
    response = TimeEntryResponse.model_validate(entry).model_dump()
    response["caregiver_name"] = entry.caregiver.name
    return response


@router.put("/{entry_id}", response_model=TimeEntryResponse)
def update_time_entry(
    entry_id: int,
    update: TimeEntryUpdate,
    db: Session = Depends(get_db)
):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found"
        )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(entry, field, value)

    # Recalculate total_pay if hours or rate changed
    entry.total_pay = calculate_total_pay(entry.hours, entry.hourly_rate)

    db.commit()
    db.refresh(entry)

    response = TimeEntryResponse.model_validate(entry).model_dump()
    response["caregiver_name"] = entry.caregiver.name
    return response


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Time entry not found"
        )

    db.delete(entry)
    db.commit()


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_time_entries(request: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete multiple time entries by their IDs."""
    if not request.ids:
        return BulkDeleteResponse(deleted_count=0)

    deleted_count = db.query(TimeEntry).filter(
        TimeEntry.id.in_(request.ids)
    ).delete(synchronize_session=False)
    db.commit()

    return BulkDeleteResponse(deleted_count=deleted_count)


@router.post("/bulk-update", response_model=BulkUpdateResponse)
def bulk_update_time_entries(request: BulkUpdateRequest, db: Session = Depends(get_db)):
    """Update multiple time entries with the same field values."""
    if not request.ids:
        return BulkUpdateResponse(updated_count=0)

    update_data = request.updates.model_dump(exclude_unset=True)
    if not update_data:
        return BulkUpdateResponse(updated_count=0)

    # Get entries to update
    entries = db.query(TimeEntry).filter(TimeEntry.id.in_(request.ids)).all()
    updated_count = 0

    for entry in entries:
        for field, value in update_data.items():
            setattr(entry, field, value)

        # Recalculate total_pay if hours or rate changed
        entry.total_pay = calculate_total_pay(entry.hours, entry.hourly_rate)
        updated_count += 1

    db.commit()

    return BulkUpdateResponse(updated_count=updated_count)
