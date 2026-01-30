"""API routes for importing data from Excel files."""

from datetime import date
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.excel_parser import ExcelParser
from app.services.import_service import ImportService

router = APIRouter(prefix="/api/import", tags=["import"])


# Request/Response schemas
class ImportPreviewResponse(BaseModel):
    """Response schema for import preview."""

    caregivers: dict[str, Any]
    time_entries: dict[str, Any]
    expenses: dict[str, Any]
    pay_periods: dict[str, Any]


class ImportResultResponse(BaseModel):
    """Response schema for import operations."""

    created: int
    skipped: int = 0
    errors: list[str] = []


class GeneratePeriodsRequest(BaseModel):
    """Request schema for generating pay periods."""

    start_date: date
    end_date: date
    period_length_days: int = 14


class GeneratePeriodsResponse(BaseModel):
    """Response schema for generated periods."""

    created: int
    total: int
    periods: list[dict[str, Any]]


class ImportCaregiversRequest(BaseModel):
    """Request schema for importing caregivers."""

    caregivers: list[dict[str, Any]]


class ImportTimeEntriesRequest(BaseModel):
    """Request schema for importing time entries."""

    entries: list[dict[str, Any]]
    default_period_id: int | None = None


class ImportExpensesRequest(BaseModel):
    """Request schema for importing expenses."""

    expenses: list[dict[str, Any]]
    default_period_id: int | None = None


# In-memory storage for parsed data (per session)
# In production, you'd use Redis or similar
_parsed_data_cache: dict[str, dict] = {}


@router.post("/upload", response_model=ImportPreviewResponse)
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload an Excel file and get a preview of the data.

    Returns parsed data summary for preview before actual import.
    """
    if not file.filename or not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)",
        )

    # Save uploaded file temporarily
    try:
        with NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = Path(tmp.name)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {str(e)}",
        )

    try:
        # Parse the file
        parser = ExcelParser(tmp_path)
        caregivers = parser.parse_caregivers()
        time_entries = parser.parse_time_entries()
        expenses = parser.parse_expenses()

        # Generate a cache key (could use session ID in production)
        cache_key = f"import_{file.filename}"
        _parsed_data_cache[cache_key] = {
            "caregivers": caregivers,
            "time_entries": [
                {
                    **entry,
                    "date": entry["date"].isoformat() if entry.get("date") else None,
                    "hourly_rate": str(entry.get("hourly_rate", "15.00")),
                    "hours": str(entry.get("hours", "0")),
                    "total_pay": str(entry.get("total_pay", "0")),
                    "time_in": entry["time_in"].isoformat() if entry.get("time_in") else None,
                    "time_out": entry["time_out"].isoformat() if entry.get("time_out") else None,
                }
                for entry in time_entries
            ],
            "expenses": [
                {
                    **exp,
                    "date": exp["date"].isoformat() if exp.get("date") else None,
                    "amount": str(exp.get("amount", "0")),
                }
                for exp in expenses
            ],
        }

        # Get preview with database comparison
        import_service = ImportService(db)
        preview = import_service.get_import_preview(
            caregivers, time_entries, expenses
        )

        return ImportPreviewResponse(**preview)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse Excel file: {str(e)}",
        )
    finally:
        # Clean up temp file
        try:
            tmp_path.unlink()
        except Exception:
            pass


@router.post("/parse-file")
async def parse_file_path(
    file_path: str,
    db: Session = Depends(get_db),
):
    """
    Parse an Excel file from a local file path.

    Useful for server-side imports where file is already on disk.
    """
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {file_path}",
        )

    try:
        parser = ExcelParser(path)
        caregivers = parser.parse_caregivers()
        time_entries = parser.parse_time_entries()
        expenses = parser.parse_expenses()

        # Cache parsed data
        cache_key = f"import_{path.name}"
        _parsed_data_cache[cache_key] = {
            "caregivers": caregivers,
            "time_entries": [
                {
                    **entry,
                    "date": entry["date"].isoformat() if entry.get("date") else None,
                    "hourly_rate": str(entry.get("hourly_rate", "15.00")),
                    "hours": str(entry.get("hours", "0")),
                    "total_pay": str(entry.get("total_pay", "0")),
                    "time_in": entry["time_in"].isoformat() if entry.get("time_in") else None,
                    "time_out": entry["time_out"].isoformat() if entry.get("time_out") else None,
                }
                for entry in time_entries
            ],
            "expenses": [
                {
                    **exp,
                    "date": exp["date"].isoformat() if exp.get("date") else None,
                    "amount": str(exp.get("amount", "0")),
                }
                for exp in expenses
            ],
        }

        # Get preview
        import_service = ImportService(db)
        preview = import_service.get_import_preview(
            caregivers, time_entries, expenses
        )

        return {
            "cache_key": cache_key,
            "preview": preview,
            "data": {
                "caregivers": [
                    {"name": c["name"], "default_hourly_rate": str(c["default_hourly_rate"])}
                    for c in caregivers
                ],
                "time_entries_count": len(time_entries),
                "expenses_count": len(expenses),
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse Excel file: {str(e)}",
        )


@router.post("/caregivers", response_model=ImportResultResponse)
async def import_caregivers(
    request: ImportCaregiversRequest,
    db: Session = Depends(get_db),
):
    """
    Import caregivers from parsed data.

    Skips duplicates based on name.
    """
    import_service = ImportService(db)

    # Convert string rates back to Decimal
    from decimal import Decimal

    caregivers = []
    for cg in request.caregivers:
        caregivers.append({
            "name": cg["name"],
            "default_hourly_rate": Decimal(str(cg.get("default_hourly_rate", "15.00"))),
        })

    result = import_service.import_caregivers(caregivers)
    return ImportResultResponse(**result)


@router.post("/time-entries", response_model=ImportResultResponse)
async def import_time_entries(
    request: ImportTimeEntriesRequest,
    db: Session = Depends(get_db),
):
    """
    Import time entries from parsed data.

    Requires pay periods to exist for the date range.
    """
    import_service = ImportService(db)

    # Convert string values back to proper types
    from datetime import time as time_type
    from decimal import Decimal

    entries = []
    for entry in request.entries:
        parsed_entry = {
            "caregiver_name": entry["caregiver_name"],
            "date": date.fromisoformat(entry["date"]) if entry.get("date") else None,
            "hourly_rate": Decimal(str(entry.get("hourly_rate", "15.00"))),
            "hours": Decimal(str(entry.get("hours", "0"))),
            "total_pay": Decimal(str(entry.get("total_pay", "0"))),
            "notes": entry.get("notes"),
            "time_in": None,
            "time_out": None,
        }

        if entry.get("time_in"):
            try:
                parsed_entry["time_in"] = time_type.fromisoformat(entry["time_in"])
            except ValueError:
                pass

        if entry.get("time_out"):
            try:
                parsed_entry["time_out"] = time_type.fromisoformat(entry["time_out"])
            except ValueError:
                pass

        entries.append(parsed_entry)

    result = import_service.import_time_entries(entries, request.default_period_id)
    return ImportResultResponse(**result)


@router.post("/expenses", response_model=ImportResultResponse)
async def import_expenses(
    request: ImportExpensesRequest,
    db: Session = Depends(get_db),
):
    """
    Import expenses from parsed data.

    Requires pay periods to exist for expenses with dates.
    """
    import_service = ImportService(db)

    # Convert string values back to proper types
    from decimal import Decimal

    expenses = []
    for exp in request.expenses:
        parsed_exp = {
            "description": exp["description"],
            "amount": Decimal(str(exp.get("amount", "0"))),
            "paid_by": exp.get("paid_by", "Rafi"),
            "category": exp.get("category", "Other"),
            "date": date.fromisoformat(exp["date"]) if exp.get("date") else None,
            "date_estimated": exp.get("date_estimated", True),
        }
        expenses.append(parsed_exp)

    result = import_service.import_expenses(expenses, request.default_period_id)

    return ImportResultResponse(
        created=result["created"],
        skipped=result["skipped"],
        errors=result["errors"],
    )


@router.post("/generate-periods", response_model=GeneratePeriodsResponse)
async def generate_pay_periods(
    request: GeneratePeriodsRequest,
    db: Session = Depends(get_db),
):
    """
    Generate bi-weekly pay periods for a date range.

    Creates periods that don't already exist.
    """
    import_service = ImportService(db)
    result = import_service.generate_pay_periods(
        request.start_date,
        request.end_date,
        request.period_length_days,
    )
    return GeneratePeriodsResponse(**result)


@router.get("/cached/{cache_key}")
async def get_cached_data(cache_key: str):
    """
    Retrieve previously parsed data from cache.

    Returns the full parsed data for a given cache key.
    """
    data = _parsed_data_cache.get(cache_key)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No cached data found for key: {cache_key}",
        )
    return data


@router.delete("/cached/{cache_key}")
async def clear_cached_data(cache_key: str):
    """Clear cached parsed data."""
    if cache_key in _parsed_data_cache:
        del _parsed_data_cache[cache_key]
        return {"message": "Cache cleared"}
    return {"message": "No cache entry found"}
