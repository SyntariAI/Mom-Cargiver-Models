from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.caregiver import Caregiver
from app.schemas.caregiver import (
    CaregiverCreate, CaregiverUpdate, CaregiverResponse
)

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


@router.get("", response_model=list[CaregiverResponse])
def list_caregivers(db: Session = Depends(get_db)):
    return db.query(Caregiver).all()


@router.post("", response_model=CaregiverResponse, status_code=status.HTTP_201_CREATED)
def create_caregiver(caregiver: CaregiverCreate, db: Session = Depends(get_db)):
    # Check for duplicate name
    existing = db.query(Caregiver).filter(Caregiver.name == caregiver.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Caregiver with name '{caregiver.name}' already exists"
        )

    db_caregiver = Caregiver(**caregiver.model_dump())
    db.add(db_caregiver)
    db.commit()
    db.refresh(db_caregiver)
    return db_caregiver


@router.get("/{caregiver_id}", response_model=CaregiverResponse)
def get_caregiver(caregiver_id: int, db: Session = Depends(get_db)):
    caregiver = db.query(Caregiver).filter(Caregiver.id == caregiver_id).first()
    if not caregiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found"
        )
    return caregiver


@router.put("/{caregiver_id}", response_model=CaregiverResponse)
def update_caregiver(
    caregiver_id: int,
    update: CaregiverUpdate,
    db: Session = Depends(get_db)
):
    caregiver = db.query(Caregiver).filter(Caregiver.id == caregiver_id).first()
    if not caregiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found"
        )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(caregiver, field, value)

    db.commit()
    db.refresh(caregiver)
    return caregiver


@router.delete("/{caregiver_id}", response_model=CaregiverResponse)
def deactivate_caregiver(caregiver_id: int, db: Session = Depends(get_db)):
    caregiver = db.query(Caregiver).filter(Caregiver.id == caregiver_id).first()
    if not caregiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caregiver not found"
        )

    caregiver.is_active = False
    db.commit()
    db.refresh(caregiver)
    return caregiver
