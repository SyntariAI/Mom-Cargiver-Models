from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.time_entry import TimeEntry
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod
from app.schemas.time_entry import (
    TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse, TimeEntryBulkCreate
)

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


@router.post("/bulk", response_model=list[TimeEntryResponse], status_code=status.HTTP_201_CREATED)
def create_time_entries_bulk(bulk: TimeEntryBulkCreate, db: Session = Depends(get_db)):
    results = []
    for entry in bulk.entries:
        result = create_time_entry(entry, db)
        results.append(result)
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
