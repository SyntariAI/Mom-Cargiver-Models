from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.pay_period import PayPeriod, PeriodStatus
from app.schemas.pay_period import (
    PayPeriodCreate, PayPeriodUpdate, PayPeriodResponse
)

router = APIRouter(prefix="/api/pay-periods", tags=["pay-periods"])


@router.get("", response_model=list[PayPeriodResponse])
def list_pay_periods(db: Session = Depends(get_db)):
    return db.query(PayPeriod).order_by(PayPeriod.start_date.desc()).all()


@router.get("/current", response_model=PayPeriodResponse)
def get_current_period(db: Session = Depends(get_db)):
    period = db.query(PayPeriod).filter(
        PayPeriod.status == PeriodStatus.OPEN
    ).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No open pay period found"
        )
    return period


@router.post("", response_model=PayPeriodResponse, status_code=status.HTTP_201_CREATED)
def create_pay_period(period: PayPeriodCreate, db: Session = Depends(get_db)):
    # Check for existing open period
    existing_open = db.query(PayPeriod).filter(
        PayPeriod.status == PeriodStatus.OPEN
    ).first()
    if existing_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already an open period. Close it before creating a new one."
        )

    db_period = PayPeriod(
        start_date=period.start_date,
        end_date=period.end_date,
        notes=period.notes,
        status=PeriodStatus.OPEN
    )
    db.add(db_period)
    db.commit()
    db.refresh(db_period)
    return db_period


@router.get("/{period_id}", response_model=PayPeriodResponse)
def get_pay_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )
    return period


@router.put("/{period_id}", response_model=PayPeriodResponse)
def update_pay_period(
    period_id: int,
    update: PayPeriodUpdate,
    db: Session = Depends(get_db)
):
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )

    if update.notes is not None:
        period.notes = update.notes

    db.commit()
    db.refresh(period)
    return period


@router.post("/{period_id}/close", response_model=PayPeriodResponse)
def close_pay_period(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )

    if period.status == PeriodStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Period is already closed"
        )

    period.status = PeriodStatus.CLOSED
    db.commit()
    db.refresh(period)
    return period
