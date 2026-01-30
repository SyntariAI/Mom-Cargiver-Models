"""Service for importing parsed Excel data into the database."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.caregiver import Caregiver
from app.models.expense import Expense, ExpenseCategory, Payer
from app.models.pay_period import PayPeriod, PeriodStatus
from app.models.time_entry import TimeEntry


class ImportService:
    """Service for importing data from parsed Excel files."""

    def __init__(self, db: Session):
        """Initialize with database session."""
        self.db = db

    def import_caregivers(self, caregivers: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Import caregivers, skipping duplicates.

        Args:
            caregivers: List of dicts with 'name' and 'default_hourly_rate'

        Returns:
            Dict with 'created', 'skipped', and 'errors' counts
        """
        created = 0
        skipped = 0
        errors: list[str] = []

        for cg in caregivers:
            name = cg.get("name", "").strip()
            if not name:
                errors.append("Empty caregiver name")
                continue

            # Check if already exists
            existing = self.db.query(Caregiver).filter(
                Caregiver.name == name
            ).first()

            if existing:
                skipped += 1
                continue

            try:
                rate = cg.get("default_hourly_rate", Decimal("15.00"))
                caregiver = Caregiver(
                    name=name,
                    default_hourly_rate=rate,
                    is_active=True,
                )
                self.db.add(caregiver)
                self.db.flush()  # Get ID without committing
                created += 1
            except Exception as e:
                errors.append(f"Error creating caregiver '{name}': {str(e)}")

        self.db.commit()

        return {
            "created": created,
            "skipped": skipped,
            "errors": errors,
        }

    def import_time_entries(
        self, entries: list[dict[str, Any]], default_period_id: int | None = None
    ) -> dict[str, Any]:
        """
        Import time entries, assigning to appropriate pay periods.

        Args:
            entries: List of parsed time entry dicts
            default_period_id: Optional period ID to use if entry date
                              doesn't match any existing period

        Returns:
            Dict with 'created', 'skipped', and 'errors' info
        """
        created = 0
        skipped = 0
        errors: list[str] = []

        # Build caregiver name -> id mapping
        caregivers = {c.name: c.id for c in self.db.query(Caregiver).all()}

        # Build period lookup by date range
        periods = self.db.query(PayPeriod).all()

        for entry in entries:
            caregiver_name = entry.get("caregiver_name", "")
            entry_date = entry.get("date")

            if not caregiver_name or not entry_date:
                errors.append(f"Missing caregiver or date in entry")
                continue

            # Find caregiver ID
            caregiver_id = caregivers.get(caregiver_name)
            if not caregiver_id:
                errors.append(f"Unknown caregiver: {caregiver_name}")
                continue

            # Find matching pay period
            period_id = self._find_period_for_date(periods, entry_date)
            if not period_id:
                period_id = default_period_id

            if not period_id:
                errors.append(
                    f"No pay period found for date {entry_date} "
                    f"(caregiver: {caregiver_name})"
                )
                continue

            try:
                time_entry = TimeEntry(
                    pay_period_id=period_id,
                    caregiver_id=caregiver_id,
                    date=entry_date,
                    time_in=entry.get("time_in"),
                    time_out=entry.get("time_out"),
                    hours=entry.get("hours", Decimal("0")),
                    hourly_rate=entry.get("hourly_rate", Decimal("15.00")),
                    total_pay=entry.get("total_pay", Decimal("0")),
                    notes=entry.get("notes"),
                )
                self.db.add(time_entry)
                self.db.flush()
                created += 1
            except Exception as e:
                errors.append(
                    f"Error creating time entry for {caregiver_name} "
                    f"on {entry_date}: {str(e)}"
                )

        self.db.commit()

        return {
            "created": created,
            "skipped": skipped,
            "errors": errors,
        }

    def import_expenses(
        self, expenses: list[dict[str, Any]], default_period_id: int | None = None
    ) -> dict[str, Any]:
        """
        Import expenses, assigning to appropriate pay periods.

        Args:
            expenses: List of parsed expense dicts
            default_period_id: Period ID to use for expenses without dates

        Returns:
            Dict with 'created', 'skipped', and 'errors' info
        """
        created = 0
        skipped = 0
        errors: list[str] = []

        # Build period lookup
        periods = self.db.query(PayPeriod).all()

        # Track which expenses need date estimation
        expenses_needing_dates: list[tuple[Expense, int]] = []

        for idx, exp in enumerate(expenses):
            description = exp.get("description", "")
            amount = exp.get("amount")

            if not description or amount is None:
                errors.append(f"Missing description or amount in expense #{idx}")
                continue

            # Parse paid_by
            paid_by_str = exp.get("paid_by", "Rafi")
            try:
                paid_by = Payer(paid_by_str)
            except ValueError:
                paid_by = Payer.RAFI

            # Parse category
            category_str = exp.get("category", "Other")
            try:
                category = ExpenseCategory(category_str)
            except ValueError:
                category = ExpenseCategory.OTHER

            # Determine date and period
            expense_date = exp.get("date")
            date_estimated = exp.get("date_estimated", expense_date is None)

            if expense_date:
                period_id = self._find_period_for_date(periods, expense_date)
            else:
                period_id = None
                expense_date = date.today()  # Placeholder, will be estimated

            if not period_id:
                period_id = default_period_id

            if not period_id:
                errors.append(
                    f"No pay period for expense '{description}' "
                    f"(date: {expense_date})"
                )
                continue

            try:
                expense = Expense(
                    pay_period_id=period_id,
                    date=expense_date,
                    description=description,
                    amount=amount,
                    paid_by=paid_by,
                    category=category,
                    is_recurring=False,
                    date_estimated=date_estimated,
                )
                self.db.add(expense)
                self.db.flush()
                created += 1

                if date_estimated and not exp.get("date"):
                    expenses_needing_dates.append((expense, idx))

            except Exception as e:
                errors.append(f"Error creating expense '{description}': {str(e)}")

        self.db.commit()

        return {
            "created": created,
            "skipped": skipped,
            "errors": errors,
            "expenses_needing_date_estimation": len(expenses_needing_dates),
        }

    def generate_pay_periods(
        self,
        start_date: date,
        end_date: date,
        period_length_days: int = 14,
    ) -> dict[str, Any]:
        """
        Generate bi-weekly pay periods between dates.

        Args:
            start_date: First day of the first period
            end_date: Last date to cover (periods may extend beyond)
            period_length_days: Length of each period (default 14 for bi-weekly)

        Returns:
            Dict with 'created' count and list of 'periods'
        """
        created = 0
        periods: list[dict[str, Any]] = []

        current_start = start_date

        while current_start <= end_date:
            current_end = current_start + timedelta(days=period_length_days - 1)

            # Check if period already exists (overlapping dates)
            existing = self.db.query(PayPeriod).filter(
                PayPeriod.start_date == current_start,
                PayPeriod.end_date == current_end,
            ).first()

            if existing:
                periods.append({
                    "id": existing.id,
                    "start_date": existing.start_date.isoformat(),
                    "end_date": existing.end_date.isoformat(),
                    "status": existing.status.value,
                    "existing": True,
                })
            else:
                # Determine if this is historical (before today)
                is_historical = current_end < date.today()

                period = PayPeriod(
                    start_date=current_start,
                    end_date=current_end,
                    status=PeriodStatus.CLOSED if is_historical else PeriodStatus.OPEN,
                    is_historical=is_historical,
                    notes="Auto-generated from import" if is_historical else None,
                )
                self.db.add(period)
                self.db.flush()
                created += 1

                periods.append({
                    "id": period.id,
                    "start_date": period.start_date.isoformat(),
                    "end_date": period.end_date.isoformat(),
                    "status": period.status.value,
                    "existing": False,
                })

            current_start = current_end + timedelta(days=1)

        self.db.commit()

        return {
            "created": created,
            "total": len(periods),
            "periods": periods,
        }

    def _find_period_for_date(
        self, periods: list[PayPeriod], target_date: date
    ) -> int | None:
        """Find the pay period ID that contains the given date."""
        for period in periods:
            if period.start_date <= target_date <= period.end_date:
                return period.id
        return None

    def get_import_preview(
        self,
        caregivers: list[dict],
        time_entries: list[dict],
        expenses: list[dict],
    ) -> dict[str, Any]:
        """
        Generate a preview of what would be imported.

        Returns information about new vs existing data.
        """
        # Check existing caregivers
        existing_names = {
            c.name for c in self.db.query(Caregiver).all()
        }
        new_caregivers = [
            c for c in caregivers if c.get("name") not in existing_names
        ]

        # Get date range from time entries
        dates = [e["date"] for e in time_entries if e.get("date")]
        min_date = min(dates) if dates else None
        max_date = max(dates) if dates else None

        # Check existing periods
        existing_periods = self.db.query(PayPeriod).all()
        periods_exist = len(existing_periods) > 0

        return {
            "caregivers": {
                "total": len(caregivers),
                "new": len(new_caregivers),
                "existing": len(caregivers) - len(new_caregivers),
                "names": [c["name"] for c in new_caregivers],
            },
            "time_entries": {
                "total": len(time_entries),
                "date_range": {
                    "start": min_date.isoformat() if min_date else None,
                    "end": max_date.isoformat() if max_date else None,
                },
            },
            "expenses": {
                "total": len(expenses),
                "with_dates": len([e for e in expenses if e.get("date")]),
                "without_dates": len([e for e in expenses if not e.get("date")]),
            },
            "pay_periods": {
                "existing_count": len(existing_periods),
                "need_generation": not periods_exist and len(time_entries) > 0,
            },
        }
