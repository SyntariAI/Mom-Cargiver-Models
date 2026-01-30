"""Excel file parser for importing caregiver data."""

import re
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any

import pandas as pd


class ExcelParser:
    """Parser for the caregiver Excel file format."""

    # Sheet name constants
    CAREGIVERS_SHEET = "Data Export - Caregivers"
    TIME_ENTRIES_SHEET = "Data Export - Time Entries"
    EXPENSES_SHEET = "Data Export - Expenses"

    # Category inference keywords
    CATEGORY_KEYWORDS = {
        "Groceries": ["walmart", "costco", "publix", "fresh market", "grocery", "food"],
        "Medical": ["walgreens", "cvs", "pharmacy", "doctor", "medical", "hospital"],
        "Utilities": ["fpl", "electric", "water", "gas", "utility", "internet", "phone"],
        "Rent": ["rent"],
        "Insurance": ["insurance", "mutual of omaha"],
        "Supplies": ["amazon", "wipes", "cream", "supplies", "diaper"],
    }

    # Date pattern for embedded dates like "1/12/25", "1/24", "2/15"
    DATE_PATTERN = re.compile(r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?")

    def __init__(self, file_path: Path | str):
        """Initialize parser with path to Excel file."""
        self.file_path = Path(file_path)
        self._excel_file: pd.ExcelFile | None = None

    @property
    def excel_file(self) -> pd.ExcelFile:
        """Lazy load the Excel file."""
        if self._excel_file is None:
            self._excel_file = pd.ExcelFile(self.file_path)
        return self._excel_file

    def get_sheet_names(self) -> list[str]:
        """Return list of sheet names in the Excel file."""
        return self.excel_file.sheet_names

    def parse_caregivers(self) -> list[dict[str, Any]]:
        """
        Parse caregivers sheet.

        Returns:
            List of dicts with keys: name, default_hourly_rate
        """
        try:
            df = pd.read_excel(self.excel_file, self.CAREGIVERS_SHEET)
        except ValueError:
            # Try alternative sheet names
            sheets = self.excel_file.sheet_names
            caregiver_sheet = next(
                (s for s in sheets if "caregiver" in s.lower()), None
            )
            if caregiver_sheet:
                df = pd.read_excel(self.excel_file, caregiver_sheet)
            else:
                return []

        caregivers = []
        for _, row in df.iterrows():
            name = str(row.get("name", row.get("Name", ""))).strip()
            if not name or name == "nan":
                continue

            rate = row.get(
                "default_hourly_rate", row.get("Rate", row.get("rate", 15))
            )
            if pd.isna(rate):
                rate = 15

            caregivers.append({
                "name": name,
                "default_hourly_rate": Decimal(str(float(rate))),
            })

        return caregivers

    def parse_time_entries(self) -> list[dict[str, Any]]:
        """
        Parse time entries sheet.

        Returns:
            List of dicts with keys: date, caregiver_name, hourly_rate,
            time_in, time_out, hours, total_pay, notes
        """
        try:
            df = pd.read_excel(self.excel_file, self.TIME_ENTRIES_SHEET)
        except ValueError:
            sheets = self.excel_file.sheet_names
            time_sheet = next(
                (s for s in sheets if "time" in s.lower()), None
            )
            if time_sheet:
                df = pd.read_excel(self.excel_file, time_sheet)
            else:
                return []

        entries = []
        for _, row in df.iterrows():
            caregiver_name = str(
                row.get("caregiver", row.get("Name", row.get("name", "")))
            ).strip()
            if not caregiver_name or caregiver_name == "nan":
                continue

            # Parse date
            entry_date = row.get("date", row.get("Date"))
            if pd.isna(entry_date):
                continue
            if isinstance(entry_date, datetime):
                entry_date = entry_date.date()
            elif isinstance(entry_date, str):
                entry_date = datetime.strptime(entry_date, "%Y-%m-%d").date()

            # Parse times
            time_in = self._parse_time(row.get("time_in", row.get("Time In")))
            time_out = self._parse_time(row.get("time_out", row.get("Time Out")))

            # Parse numeric fields
            hourly_rate = row.get(
                "hourly_rate", row.get("Rate", row.get("rate", 15))
            )
            if pd.isna(hourly_rate):
                hourly_rate = 15

            hours = row.get("hours", row.get("Hours", 0))
            if pd.isna(hours):
                hours = 0

            pay = row.get("pay", row.get("Payment", row.get("total_pay", 0)))
            if pd.isna(pay):
                pay = float(hours) * float(hourly_rate)

            # Get shift type as notes
            shift_type = row.get("shift_type", "")
            notes = str(shift_type) if not pd.isna(shift_type) else None

            entries.append({
                "date": entry_date,
                "caregiver_name": caregiver_name,
                "hourly_rate": Decimal(str(float(hourly_rate))),
                "time_in": time_in,
                "time_out": time_out,
                "hours": Decimal(str(float(hours))),
                "total_pay": Decimal(str(float(pay))),
                "notes": notes,
            })

        return entries

    def parse_expenses(self) -> list[dict[str, Any]]:
        """
        Parse expenses sheet.

        Returns:
            List of dicts with keys: description, amount, paid_by, date,
            category, date_estimated
        """
        try:
            df = pd.read_excel(self.excel_file, self.EXPENSES_SHEET)
        except ValueError:
            sheets = self.excel_file.sheet_names
            expense_sheet = next(
                (s for s in sheets if "expense" in s.lower()), None
            )
            if expense_sheet:
                df = pd.read_excel(self.excel_file, expense_sheet)
            else:
                return []

        expenses = []
        for _, row in df.iterrows():
            description = str(row.get("description", row.get("Description", "")))
            if not description or description == "nan":
                continue

            amount = row.get("amount", row.get("Amount", 0))
            if pd.isna(amount):
                continue

            # Get paid_by - use existing column or try to infer
            paid_by = row.get("paid_by", row.get("Paid By", ""))
            if pd.isna(paid_by) or not paid_by:
                paid_by = "Rafi"  # Default

            # Get category - use existing or infer
            category = row.get("category", row.get("Category", ""))
            if pd.isna(category) or not category:
                category = self._infer_category(description)

            # Try to extract date from description
            extracted_date, date_estimated = self._extract_date_from_description(
                description
            )

            expenses.append({
                "description": description,
                "amount": Decimal(str(float(amount))),
                "paid_by": str(paid_by),
                "date": extracted_date,
                "category": str(category) if category else "Other",
                "date_estimated": date_estimated,
            })

        return expenses

    def _parse_time(self, time_value: Any) -> time | None:
        """Parse a time value from various formats."""
        if pd.isna(time_value):
            return None

        if isinstance(time_value, time):
            return time_value

        if isinstance(time_value, datetime):
            return time_value.time()

        if isinstance(time_value, str):
            time_str = time_value.strip()
            if not time_str:
                return None

            # Try common formats
            for fmt in ["%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"]:
                try:
                    return datetime.strptime(time_str, fmt).time()
                except ValueError:
                    continue

        return None

    def _infer_category(self, description: str) -> str:
        """Infer expense category from description keywords."""
        desc_lower = description.lower()
        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in desc_lower:
                    return category
        return "Other"

    def _extract_date_from_description(
        self, description: str
    ) -> tuple[date | None, bool]:
        """
        Extract date from description text.

        Looks for patterns like:
        - "Walmart 1/12/25" -> date(2025, 1, 12)
        - "FPL 1/24" -> date(current_year, 1, 24)
        - "Rent 2/15" -> date(current_year, 2, 15)

        Returns:
            Tuple of (extracted_date or None, date_estimated: bool)
        """
        match = self.DATE_PATTERN.search(description)
        if not match:
            return None, True  # No date found, will need estimation

        month = int(match.group(1))
        day = int(match.group(2))
        year_str = match.group(3)

        if year_str:
            year = int(year_str)
            if year < 100:
                # Two-digit year - assume 2000s
                year = 2000 + year
        else:
            # No year provided, use current year
            year = datetime.now().year

        try:
            return date(year, month, day), False
        except ValueError:
            # Invalid date
            return None, True

    def get_date_range(self) -> tuple[date | None, date | None]:
        """
        Get the date range from time entries.

        Returns:
            Tuple of (min_date, max_date) or (None, None) if no entries
        """
        entries = self.parse_time_entries()
        if not entries:
            return None, None

        dates = [e["date"] for e in entries if e["date"]]
        if not dates:
            return None, None

        return min(dates), max(dates)

    def get_summary(self) -> dict[str, Any]:
        """
        Get a summary of the parsed data.

        Returns:
            Dict with counts and date ranges for preview
        """
        caregivers = self.parse_caregivers()
        time_entries = self.parse_time_entries()
        expenses = self.parse_expenses()

        min_date, max_date = self.get_date_range()

        return {
            "caregivers": {
                "count": len(caregivers),
                "names": [c["name"] for c in caregivers],
            },
            "time_entries": {
                "count": len(time_entries),
                "date_range": {
                    "start": min_date.isoformat() if min_date else None,
                    "end": max_date.isoformat() if max_date else None,
                },
            },
            "expenses": {
                "count": len(expenses),
                "by_payer": {
                    payer: len([e for e in expenses if e["paid_by"] == payer])
                    for payer in set(e["paid_by"] for e in expenses)
                },
            },
        }
