from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Settlement, PayPeriod
from app.schemas.settlement import SettlementResponse, MarkSettledRequest
from app.services.settlement_calculator import calculate_settlement

router = APIRouter(prefix="/api/settlements", tags=["settlements"])


@router.get("/{period_id}", response_model=SettlementResponse)
def get_settlement(period_id: int, db: Session = Depends(get_db)):
    # Verify period exists
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )

    # Calculate (or get existing) settlement
    settlement = calculate_settlement(db, period_id)
    return settlement


@router.post("/{period_id}/calculate", response_model=SettlementResponse)
def recalculate_settlement(period_id: int, db: Session = Depends(get_db)):
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )

    settlement = calculate_settlement(db, period_id)
    return settlement


@router.post("/{period_id}/mark-settled", response_model=SettlementResponse)
def mark_settled(
    period_id: int,
    request: MarkSettledRequest,
    db: Session = Depends(get_db)
):
    # Verify period exists
    period = db.query(PayPeriod).filter(PayPeriod.id == period_id).first()
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pay period not found"
        )

    settlement = db.query(Settlement).filter(
        Settlement.pay_period_id == period_id
    ).first()

    if not settlement:
        # Create settlement first
        settlement = calculate_settlement(db, period_id)

    settlement.settled = True
    settlement.settled_at = datetime.now(timezone.utc)
    settlement.payment_method = request.payment_method

    db.commit()
    db.refresh(settlement)
    return settlement
