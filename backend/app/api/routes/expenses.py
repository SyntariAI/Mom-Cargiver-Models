from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.expense import Expense, Payer, ExpenseCategory
from app.models.pay_period import PayPeriod
from app.schemas.expense import (
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary
)


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class BulkDeleteResponse(BaseModel):
    deleted_count: int


class BulkUpdateRequest(BaseModel):
    ids: list[int]
    updates: ExpenseUpdate


class BulkUpdateResponse(BaseModel):
    updated_count: int

router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("", response_model=list[ExpenseResponse])
def list_expenses(
    period_id: int | None = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Expense)
    if period_id:
        query = query.filter(Expense.pay_period_id == period_id)
    return query.order_by(Expense.date).all()


@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(
    period_id: int = Query(...),
    db: Session = Depends(get_db)
):
    expenses = db.query(Expense).filter(Expense.pay_period_id == period_id).all()

    adi_total = sum(e.amount for e in expenses if e.paid_by == Payer.ADI)
    rafi_total = sum(e.amount for e in expenses if e.paid_by == Payer.RAFI)

    by_category = {}
    for e in expenses:
        cat = e.category.value if hasattr(e.category, 'value') else str(e.category)
        by_category[cat] = by_category.get(cat, Decimal("0")) + e.amount

    return ExpenseSummary(
        adi_total=adi_total,
        rafi_total=rafi_total,
        by_category=by_category
    )


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    # Verify or find pay period
    if expense.pay_period_id:
        period = db.query(PayPeriod).filter(PayPeriod.id == expense.pay_period_id).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pay period not found"
            )
    else:
        period = db.query(PayPeriod).filter(
            PayPeriod.start_date <= expense.date,
            PayPeriod.end_date >= expense.date
        ).first()
        if not period:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No pay period found for date {expense.date}"
            )

    db_expense = Expense(
        pay_period_id=period.id,
        date=expense.date,
        description=expense.description,
        amount=expense.amount,
        paid_by=expense.paid_by,
        category=expense.category,
        is_recurring=expense.is_recurring,
        notes=expense.notes
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    update: ExpenseUpdate,
    db: Session = Depends(get_db)
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Expense not found"
        )

    db.delete(expense)
    db.commit()


@router.post("/bulk-delete", response_model=BulkDeleteResponse)
def bulk_delete_expenses(request: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Delete multiple expenses by their IDs."""
    if not request.ids:
        return BulkDeleteResponse(deleted_count=0)

    deleted_count = db.query(Expense).filter(
        Expense.id.in_(request.ids)
    ).delete(synchronize_session=False)
    db.commit()

    return BulkDeleteResponse(deleted_count=deleted_count)


@router.post("/bulk-update", response_model=BulkUpdateResponse)
def bulk_update_expenses(request: BulkUpdateRequest, db: Session = Depends(get_db)):
    """Update multiple expenses with the same field values."""
    if not request.ids:
        return BulkUpdateResponse(updated_count=0)

    update_data = request.updates.model_dump(exclude_unset=True)
    if not update_data:
        return BulkUpdateResponse(updated_count=0)

    # Get expenses to update
    expenses = db.query(Expense).filter(Expense.id.in_(request.ids)).all()
    updated_count = 0

    for expense in expenses:
        for field, value in update_data.items():
            setattr(expense, field, value)
        updated_count += 1

    db.commit()

    return BulkUpdateResponse(updated_count=updated_count)
