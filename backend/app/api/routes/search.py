from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.time_entry import TimeEntry
from app.models.expense import Expense
from app.models.caregiver import Caregiver
from app.schemas.time_entry import TimeEntryResponse
from app.schemas.expense import ExpenseResponse
from app.schemas.caregiver import CaregiverResponse


router = APIRouter(prefix="/api", tags=["search"])


class SearchResults(BaseModel):
    time_entries: list[dict]
    expenses: list[ExpenseResponse]
    caregivers: list[CaregiverResponse]

    model_config = ConfigDict(from_attributes=True)


@router.get("/search", response_model=SearchResults)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    db: Session = Depends(get_db)
):
    """
    Search across time entries (by caregiver name, notes),
    expenses (by description), and caregivers (by name).
    """
    search_pattern = f"%{q}%"

    # Search caregivers by name
    caregivers = db.query(Caregiver).filter(
        Caregiver.name.ilike(search_pattern)
    ).all()

    # Get matching caregiver IDs for time entry search
    matching_caregiver_ids = [c.id for c in caregivers]

    # Search time entries by caregiver name or notes
    time_entry_query = db.query(TimeEntry)
    if matching_caregiver_ids:
        time_entry_query = time_entry_query.filter(
            or_(
                TimeEntry.caregiver_id.in_(matching_caregiver_ids),
                TimeEntry.notes.ilike(search_pattern)
            )
        )
    else:
        time_entry_query = time_entry_query.filter(
            TimeEntry.notes.ilike(search_pattern)
        )
    time_entries = time_entry_query.all()

    # Build time entry responses with caregiver names
    time_entry_results = []
    for entry in time_entries:
        entry_dict = TimeEntryResponse.model_validate(entry).model_dump()
        entry_dict["caregiver_name"] = entry.caregiver.name
        time_entry_results.append(entry_dict)

    # Search expenses by description
    expenses = db.query(Expense).filter(
        Expense.description.ilike(search_pattern)
    ).all()

    return SearchResults(
        time_entries=time_entry_results,
        expenses=expenses,
        caregivers=caregivers
    )
