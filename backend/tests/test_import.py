"""Tests for Excel import functionality."""

from datetime import date, time
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.excel_parser import ExcelParser

# Path to test Excel file
TEST_EXCEL_PATH = Path("/Users/rafimenachem/Downloads/caregiver.xlsx")


class TestExcelParser:
    """Test suite for ExcelParser."""

    @pytest.fixture
    def parser(self):
        """Create a parser instance for the test Excel file."""
        if not TEST_EXCEL_PATH.exists():
            pytest.skip(f"Test Excel file not found: {TEST_EXCEL_PATH}")
        return ExcelParser(TEST_EXCEL_PATH)

    def test_get_sheet_names(self, parser):
        """Test that we can read sheet names."""
        sheets = parser.get_sheet_names()
        assert len(sheets) == 3
        assert "Data Export - Caregivers" in sheets
        assert "Data Export - Time Entries" in sheets
        assert "Data Export - Expenses" in sheets

    def test_parse_caregivers(self, parser):
        """Test parsing caregivers sheet."""
        caregivers = parser.parse_caregivers()

        assert len(caregivers) == 9

        # Check expected caregivers exist
        names = [c["name"] for c in caregivers]
        assert "Julia" in names
        assert "Diana" in names
        assert "Edwina" in names
        assert "Margaret" in names
        assert "Emma" in names
        assert "Joceylne" in names
        assert "Jemma" in names
        assert "Geraldine" in names
        assert "Layy" in names

        # Check rate parsing
        julia = next(c for c in caregivers if c["name"] == "Julia")
        assert julia["default_hourly_rate"] == Decimal("15")

        jemma = next(c for c in caregivers if c["name"] == "Jemma")
        assert jemma["default_hourly_rate"] == Decimal("16")

    def test_parse_time_entries(self, parser):
        """Test parsing time entries sheet."""
        entries = parser.parse_time_entries()

        assert len(entries) == 721

        # Check first entry
        first = entries[0]
        assert first["caregiver_name"] == "Julia"
        assert first["date"] == date(2024, 1, 1)
        assert first["hours"] == Decimal("12")
        assert first["hourly_rate"] == Decimal("15")
        assert first["total_pay"] == Decimal("180")

        # Check entries have required fields
        for entry in entries:
            assert "caregiver_name" in entry
            assert "date" in entry
            assert "hours" in entry
            assert "hourly_rate" in entry
            assert "total_pay" in entry

    def test_parse_expenses(self, parser):
        """Test parsing expenses sheet."""
        expenses = parser.parse_expenses()

        assert len(expenses) == 293

        # Check that paid_by is parsed
        payers = set(e["paid_by"] for e in expenses)
        assert "Adi" in payers
        assert "Rafi" in payers

        # Check that categories are parsed
        categories = set(e["category"] for e in expenses)
        assert "Other" in categories
        assert "Medical" in categories
        assert "Groceries" in categories
        assert "Caregiver Payment" in categories

        # Check expense with date in description
        rafi_expenses = [e for e in expenses if e["paid_by"] == "Rafi"]
        walmart_expense = next(
            (e for e in rafi_expenses if "walmart" in e["description"].lower() and "1/12" in e["description"]),
            None
        )
        if walmart_expense:
            assert walmart_expense["date"] == date(2025, 1, 12)
            assert walmart_expense["date_estimated"] is False

    def test_get_date_range(self, parser):
        """Test getting date range from time entries."""
        min_date, max_date = parser.get_date_range()

        assert min_date == date(2024, 1, 1)
        # Note: max date may vary based on test data

    def test_get_summary(self, parser):
        """Test getting summary of parsed data."""
        summary = parser.get_summary()

        assert summary["caregivers"]["count"] == 9
        assert summary["time_entries"]["count"] == 721
        assert summary["expenses"]["count"] == 293

        assert "date_range" in summary["time_entries"]
        assert "by_payer" in summary["expenses"]


class TestDateExtraction:
    """Test date extraction from descriptions."""

    def test_extract_date_with_year(self):
        """Test extracting dates with full year."""
        parser = ExcelParser.__new__(ExcelParser)

        date_val, estimated = parser._extract_date_from_description("Walmart 1/12/25")
        assert date_val == date(2025, 1, 12)
        assert estimated is False

        date_val, estimated = parser._extract_date_from_description("FPL 12/1/2024")
        assert date_val == date(2024, 12, 1)
        assert estimated is False

    def test_extract_date_without_year(self):
        """Test extracting dates without year (uses current year)."""
        parser = ExcelParser.__new__(ExcelParser)
        from datetime import datetime

        current_year = datetime.now().year

        date_val, estimated = parser._extract_date_from_description("FPL 1/24")
        assert date_val == date(current_year, 1, 24)
        assert estimated is False

        date_val, estimated = parser._extract_date_from_description("Rent 2/15")
        assert date_val == date(current_year, 2, 15)
        assert estimated is False

    def test_no_date_in_description(self):
        """Test description without date."""
        parser = ExcelParser.__new__(ExcelParser)

        date_val, estimated = parser._extract_date_from_description("walmart groceries")
        assert date_val is None
        assert estimated is True

        date_val, estimated = parser._extract_date_from_description("Julia")
        assert date_val is None
        assert estimated is True


class TestCategoryInference:
    """Test category inference from descriptions."""

    def test_grocery_keywords(self):
        """Test grocery category detection."""
        parser = ExcelParser.__new__(ExcelParser)

        assert parser._infer_category("walmart groceries") == "Groceries"
        assert parser._infer_category("Costco") == "Groceries"
        assert parser._infer_category("publix food") == "Groceries"

    def test_medical_keywords(self):
        """Test medical category detection."""
        parser = ExcelParser.__new__(ExcelParser)

        assert parser._infer_category("walgreens pharmacy") == "Medical"
        assert parser._infer_category("CVS medication") == "Medical"
        assert parser._infer_category("doctor visit") == "Medical"

    def test_utilities_keywords(self):
        """Test utilities category detection."""
        parser = ExcelParser.__new__(ExcelParser)

        assert parser._infer_category("FPL 1/24") == "Utilities"
        assert parser._infer_category("electric bill") == "Utilities"
        assert parser._infer_category("water utility") == "Utilities"

    def test_other_default(self):
        """Test default Other category."""
        parser = ExcelParser.__new__(ExcelParser)

        assert parser._infer_category("random expense") == "Other"
        assert parser._infer_category("285") == "Other"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
