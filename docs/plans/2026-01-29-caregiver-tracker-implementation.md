# Caregiver Expense Tracker - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack caregiver hours and expense tracking app with settlement calculations.

**Architecture:** React frontend with TypeScript + Tailwind + shadcn/ui, FastAPI backend with SQLAlchemy ORM and SQLite database. Docker Compose for deployment.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Query, React Hook Form, Zod, Python 3.11+, FastAPI, SQLAlchemy, SQLite, Docker

---

## Phase 1: Project Foundation

### Task 1.1: Create Backend Project Structure

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/requirements.txt`

**Step 1: Create directory structure**

```bash
mkdir -p backend/app/core backend/app/api/routes backend/app/models backend/app/schemas backend/app/services
touch backend/app/__init__.py backend/app/core/__init__.py backend/app/api/__init__.py backend/app/api/routes/__init__.py backend/app/models/__init__.py backend/app/schemas/__init__.py backend/app/services/__init__.py
```

**Step 2: Create requirements.txt**

Create `backend/requirements.txt`:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
pydantic==2.5.3
pydantic-settings==2.1.0
python-multipart==0.0.6
openpyxl==3.1.2
pandas==2.1.4
pytest==7.4.4
pytest-asyncio==0.23.3
httpx==0.26.0
```

**Step 3: Create config.py**

Create `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    PROJECT_NAME: str = "Caregiver Tracker"
    DATABASE_URL: str = "sqlite:///./data/caregiver.db"
    DATA_DIR: Path = Path("./data")

    class Config:
        env_file = ".env"


settings = Settings()
```

**Step 4: Create database.py**

Create `backend/app/core/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# Ensure data directory exists
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 5: Create main.py**

Create `backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 6: Verify backend runs**

```bash
cd backend && pip install -r requirements.txt && cd ..
cd backend && python -m uvicorn app.main:app --reload --port 8000 &
sleep 3
curl http://localhost:8000/health
# Expected: {"status":"healthy"}
pkill -f "uvicorn app.main:app"
```

**Step 7: Commit**

```bash
git add backend/
git commit -m "feat: initialize FastAPI backend with config and database setup"
```

---

### Task 1.2: Create Database Models - Caregiver

**Files:**
- Create: `backend/app/models/caregiver.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_models.py`

**Step 1: Write the failing test**

Create `backend/tests/__init__.py` (empty file):
```python
```

Create `backend/tests/test_models.py`:
```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.caregiver import Caregiver


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_create_caregiver(db_session):
    caregiver = Caregiver(
        name="Julia",
        default_hourly_rate=15.00,
        is_active=True
    )
    db_session.add(caregiver)
    db_session.commit()
    db_session.refresh(caregiver)

    assert caregiver.id is not None
    assert caregiver.name == "Julia"
    assert caregiver.default_hourly_rate == 15.00
    assert caregiver.is_active is True
    assert caregiver.created_at is not None
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_caregiver -v
# Expected: FAIL - ModuleNotFoundError: No module named 'app.models.caregiver'
```

**Step 3: Create caregiver model**

Create `backend/app/models/caregiver.py`:
```python
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Numeric, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Caregiver(Base):
    __tablename__ = "caregivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    default_hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("15.00")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
```

Update `backend/app/models/__init__.py`:
```python
from app.models.caregiver import Caregiver

__all__ = ["Caregiver"]
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_caregiver -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Caregiver model with tests"
```

---

### Task 1.3: Create Database Models - PayPeriod

**Files:**
- Create: `backend/app/models/pay_period.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_models.py`:
```python
from datetime import date
from app.models.pay_period import PayPeriod, PeriodStatus


def test_create_pay_period(db_session):
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    assert period.id is not None
    assert period.start_date == date(2026, 1, 13)
    assert period.end_date == date(2026, 1, 26)
    assert period.status == PeriodStatus.OPEN
    assert period.is_historical is False
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_pay_period -v
# Expected: FAIL - ModuleNotFoundError
```

**Step 3: Create pay_period model**

Create `backend/app/models/pay_period.py`:
```python
from datetime import date, datetime
from enum import Enum
from sqlalchemy import String, Date, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PeriodStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"


class PayPeriod(Base):
    __tablename__ = "pay_periods"

    id: Mapped[int] = mapped_column(primary_key=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[PeriodStatus] = mapped_column(
        String(20), default=PeriodStatus.OPEN
    )
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
```

Update `backend/app/models/__init__.py`:
```python
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus

__all__ = ["Caregiver", "PayPeriod", "PeriodStatus"]
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_pay_period -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add PayPeriod model with status enum"
```

---

### Task 1.4: Create Database Models - TimeEntry

**Files:**
- Create: `backend/app/models/time_entry.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_models.py`:
```python
from datetime import time
from decimal import Decimal
from app.models.time_entry import TimeEntry


def test_create_time_entry(db_session):
    # First create required foreign key records
    caregiver = Caregiver(name="Diana", default_hourly_rate=15.00)
    db_session.add(caregiver)

    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=caregiver.id,
        date=date(2026, 1, 15),
        time_in=time(19, 0),
        time_out=time(7, 0),
        hours=Decimal("12.00"),
        hourly_rate=Decimal("15.00"),
        total_pay=Decimal("180.00")
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)

    assert entry.id is not None
    assert entry.hours == Decimal("12.00")
    assert entry.total_pay == Decimal("180.00")
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_time_entry -v
# Expected: FAIL - ModuleNotFoundError
```

**Step 3: Create time_entry model**

Create `backend/app/models/time_entry.py`:
```python
from datetime import date, time, datetime
from decimal import Decimal
from sqlalchemy import Date, Time, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(ForeignKey("pay_periods.id"))
    caregiver_id: Mapped[int] = mapped_column(ForeignKey("caregivers.id"))
    date: Mapped[date] = mapped_column(Date)
    time_in: Mapped[time | None] = mapped_column(Time, nullable=True)
    time_out: Mapped[time | None] = mapped_column(Time, nullable=True)
    hours: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_pay: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    caregiver = relationship("Caregiver", backref="time_entries")
    pay_period = relationship("PayPeriod", backref="time_entries")
```

Update `backend/app/models/__init__.py`:
```python
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus
from app.models.time_entry import TimeEntry

__all__ = ["Caregiver", "PayPeriod", "PeriodStatus", "TimeEntry"]
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_time_entry -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add TimeEntry model with caregiver and period relationships"
```

---

### Task 1.5: Create Database Models - Expense

**Files:**
- Create: `backend/app/models/expense.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_models.py`:
```python
from app.models.expense import Expense, Payer, ExpenseCategory


def test_create_expense(db_session):
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    expense = Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Walmart groceries",
        amount=Decimal("209.71"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.GROCERIES
    )
    db_session.add(expense)
    db_session.commit()
    db_session.refresh(expense)

    assert expense.id is not None
    assert expense.amount == Decimal("209.71")
    assert expense.paid_by == Payer.RAFI
    assert expense.category == ExpenseCategory.GROCERIES
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_expense -v
# Expected: FAIL - ModuleNotFoundError
```

**Step 3: Create expense model**

Create `backend/app/models/expense.py`:
```python
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, Date, Numeric, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Payer(str, Enum):
    ADI = "Adi"
    RAFI = "Rafi"


class ExpenseCategory(str, Enum):
    RENT = "Rent"
    UTILITIES = "Utilities"
    GROCERIES = "Groceries"
    MEDICAL = "Medical"
    CAREGIVER_PAYMENT = "Caregiver Payment"
    INSURANCE = "Insurance"
    SUPPLIES = "Supplies"
    OTHER = "Other"


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(ForeignKey("pay_periods.id"))
    date: Mapped[date] = mapped_column(Date)
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    paid_by: Mapped[Payer] = mapped_column(String(10))
    category: Mapped[ExpenseCategory] = mapped_column(String(50))
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    date_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    pay_period = relationship("PayPeriod", backref="expenses")
```

Update `backend/app/models/__init__.py`:
```python
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus
from app.models.time_entry import TimeEntry
from app.models.expense import Expense, Payer, ExpenseCategory

__all__ = [
    "Caregiver", "PayPeriod", "PeriodStatus", "TimeEntry",
    "Expense", "Payer", "ExpenseCategory"
]
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_expense -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Expense model with payer and category enums"
```

---

### Task 1.6: Create Database Models - Settlement

**Files:**
- Create: `backend/app/models/settlement.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/tests/test_models.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_models.py`:
```python
from app.models.settlement import Settlement, SettlementDirection


def test_create_settlement(db_session):
    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.CLOSED
    )
    db_session.add(period)
    db_session.commit()

    settlement = Settlement(
        pay_period_id=period.id,
        total_caregiver_cost=Decimal("1875.00"),
        total_expenses=Decimal("1258.85"),
        adi_paid=Decimal("805.00"),
        rafi_paid=Decimal("1698.85"),
        settlement_amount=Decimal("446.93"),
        settlement_direction=SettlementDirection.ADI_OWES_RAFI,
        final_amount=Decimal("446.93"),
        settled=False
    )
    db_session.add(settlement)
    db_session.commit()
    db_session.refresh(settlement)

    assert settlement.id is not None
    assert settlement.settlement_direction == SettlementDirection.ADI_OWES_RAFI
    assert settlement.final_amount == Decimal("446.93")
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_settlement -v
# Expected: FAIL - ModuleNotFoundError
```

**Step 3: Create settlement model**

Create `backend/app/models/settlement.py`:
```python
from datetime import datetime
from decimal import Decimal
from enum import Enum
from sqlalchemy import String, Numeric, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SettlementDirection(str, Enum):
    ADI_OWES_RAFI = "adi_owes_rafi"
    RAFI_OWES_ADI = "rafi_owes_adi"
    EVEN = "even"


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_period_id: Mapped[int] = mapped_column(
        ForeignKey("pay_periods.id"), unique=True
    )
    total_caregiver_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total_expenses: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    adi_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    rafi_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settlement_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settlement_direction: Mapped[SettlementDirection] = mapped_column(String(20))
    carryover_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00")
    )
    final_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    settled: Mapped[bool] = mapped_column(Boolean, default=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    # Relationships
    pay_period = relationship("PayPeriod", backref="settlement")
```

Update `backend/app/models/__init__.py`:
```python
from app.models.caregiver import Caregiver
from app.models.pay_period import PayPeriod, PeriodStatus
from app.models.time_entry import TimeEntry
from app.models.expense import Expense, Payer, ExpenseCategory
from app.models.settlement import Settlement, SettlementDirection

__all__ = [
    "Caregiver", "PayPeriod", "PeriodStatus", "TimeEntry",
    "Expense", "Payer", "ExpenseCategory",
    "Settlement", "SettlementDirection"
]
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_models.py::test_create_settlement -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add Settlement model with direction enum"
```

---

### Task 1.7: Initialize Database on Startup

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_api.py`

**Step 1: Write the failing test**

Create `backend/tests/test_api.py`:
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db


@pytest.fixture
def client():
    # Use in-memory database for tests
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
```

**Step 2: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_api.py::test_health_check -v
# Expected: PASSED (health endpoint already exists)
```

**Step 3: Update main.py to create tables on startup**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 4: Import all models so they register with Base**

Update `backend/app/core/database.py` to add at the end:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# Ensure data directory exists
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Import models so they register with Base.metadata
def import_models():
    from app.models import (
        Caregiver, PayPeriod, TimeEntry, Expense, Settlement
    )
```

Update `backend/app/main.py` to call import_models:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import models and create tables on startup
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run all tests**

```bash
cd backend && python -m pytest tests/ -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: initialize database tables on application startup"
```

---

## Phase 2: Caregiver API

### Task 2.1: Create Caregiver Schemas

**Files:**
- Create: `backend/app/schemas/caregiver.py`

**Step 1: Create Pydantic schemas**

Create `backend/app/schemas/caregiver.py`:
```python
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class CaregiverBase(BaseModel):
    name: str
    default_hourly_rate: Decimal = Decimal("15.00")
    is_active: bool = True


class CaregiverCreate(CaregiverBase):
    pass


class CaregiverUpdate(BaseModel):
    name: str | None = None
    default_hourly_rate: Decimal | None = None
    is_active: bool | None = None


class CaregiverResponse(CaregiverBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

Update `backend/app/schemas/__init__.py`:
```python
from app.schemas.caregiver import (
    CaregiverBase, CaregiverCreate, CaregiverUpdate, CaregiverResponse
)

__all__ = [
    "CaregiverBase", "CaregiverCreate", "CaregiverUpdate", "CaregiverResponse"
]
```

**Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for Caregiver"
```

---

### Task 2.2: Create Caregiver CRUD Routes

**Files:**
- Create: `backend/app/api/routes/caregivers.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:
```python
def test_create_caregiver(client):
    response = client.post(
        "/api/caregivers",
        json={"name": "Julia", "default_hourly_rate": "15.00"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Julia"
    assert data["default_hourly_rate"] == "15.00"
    assert data["is_active"] is True
    assert "id" in data


def test_list_caregivers(client):
    # Create a caregiver first
    client.post("/api/caregivers", json={"name": "Diana"})
    client.post("/api/caregivers", json={"name": "Edwina"})

    response = client.get("/api/caregivers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_caregiver(client):
    create_response = client.post("/api/caregivers", json={"name": "Margaret"})
    caregiver_id = create_response.json()["id"]

    response = client.get(f"/api/caregivers/{caregiver_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Margaret"


def test_update_caregiver(client):
    create_response = client.post(
        "/api/caregivers",
        json={"name": "Jemma", "default_hourly_rate": "15.00"}
    )
    caregiver_id = create_response.json()["id"]

    response = client.put(
        f"/api/caregivers/{caregiver_id}",
        json={"default_hourly_rate": "16.00"}
    )
    assert response.status_code == 200
    assert response.json()["default_hourly_rate"] == "16.00"


def test_deactivate_caregiver(client):
    create_response = client.post("/api/caregivers", json={"name": "Geraldine"})
    caregiver_id = create_response.json()["id"]

    response = client.delete(f"/api/caregivers/{caregiver_id}")
    assert response.status_code == 200

    # Verify deactivated
    get_response = client.get(f"/api/caregivers/{caregiver_id}")
    assert get_response.json()["is_active"] is False
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_api.py::test_create_caregiver -v
# Expected: FAIL - 404 Not Found (route doesn't exist)
```

**Step 3: Create caregiver routes**

Create `backend/app/api/routes/caregivers.py`:
```python
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
```

**Step 4: Register router in main.py**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers


@asynccontextmanager
async def lifespan(app: FastAPI):
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(caregivers.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add Caregiver CRUD API endpoints"
```

---

## Phase 3: Pay Period API

### Task 3.1: Create PayPeriod Schemas

**Files:**
- Create: `backend/app/schemas/pay_period.py`
- Modify: `backend/app/schemas/__init__.py`

**Step 1: Create schemas**

Create `backend/app/schemas/pay_period.py`:
```python
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.pay_period import PeriodStatus


class PayPeriodBase(BaseModel):
    start_date: date
    end_date: date
    notes: str | None = None


class PayPeriodCreate(PayPeriodBase):
    @field_validator('end_date')
    @classmethod
    def end_date_must_be_after_start(cls, v, info):
        if 'start_date' in info.data and v <= info.data['start_date']:
            raise ValueError('end_date must be after start_date')
        return v


class PayPeriodUpdate(BaseModel):
    notes: str | None = None


class PayPeriodResponse(PayPeriodBase):
    id: int
    status: PeriodStatus
    is_historical: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

Update `backend/app/schemas/__init__.py`:
```python
from app.schemas.caregiver import (
    CaregiverBase, CaregiverCreate, CaregiverUpdate, CaregiverResponse
)
from app.schemas.pay_period import (
    PayPeriodBase, PayPeriodCreate, PayPeriodUpdate, PayPeriodResponse
)

__all__ = [
    "CaregiverBase", "CaregiverCreate", "CaregiverUpdate", "CaregiverResponse",
    "PayPeriodBase", "PayPeriodCreate", "PayPeriodUpdate", "PayPeriodResponse",
]
```

**Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for PayPeriod"
```

---

### Task 3.2: Create PayPeriod CRUD Routes

**Files:**
- Create: `backend/app/api/routes/pay_periods.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:
```python
def test_create_pay_period(client):
    response = client.post(
        "/api/pay-periods",
        json={
            "start_date": "2026-01-13",
            "end_date": "2026-01-26"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["start_date"] == "2026-01-13"
    assert data["end_date"] == "2026-01-26"
    assert data["status"] == "open"


def test_get_current_period(client):
    # Create a period
    client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )

    response = client.get("/api/pay-periods/current")
    assert response.status_code == 200
    assert response.json()["status"] == "open"


def test_close_period(client):
    create_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = create_response.json()["id"]

    response = client.post(f"/api/pay-periods/{period_id}/close")
    assert response.status_code == 200
    assert response.json()["status"] == "closed"


def test_only_one_open_period(client):
    # Create first period
    client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )

    # Try to create another without closing first
    response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-27", "end_date": "2026-02-09"}
    )
    assert response.status_code == 400
    assert "already an open period" in response.json()["detail"].lower()
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_api.py::test_create_pay_period -v
# Expected: FAIL - 404 Not Found
```

**Step 3: Create pay_periods routes**

Create `backend/app/api/routes/pay_periods.py`:
```python
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
```

**Step 4: Register router in main.py**

Update `backend/app/main.py` to add:
```python
from app.api.routes import caregivers, pay_periods

# ... in the routers section:
app.include_router(caregivers.router)
app.include_router(pay_periods.router)
```

Full updated `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers, pay_periods


@asynccontextmanager
async def lifespan(app: FastAPI):
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(caregivers.router)
app.include_router(pay_periods.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add PayPeriod CRUD API endpoints with open period constraint"
```

---

## Phase 4: Time Entry API

### Task 4.1: Create TimeEntry Schemas

**Files:**
- Create: `backend/app/schemas/time_entry.py`
- Modify: `backend/app/schemas/__init__.py`

**Step 1: Create schemas**

Create `backend/app/schemas/time_entry.py`:
```python
from datetime import date, time, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator


class TimeEntryBase(BaseModel):
    caregiver_id: int
    date: date
    time_in: time | None = None
    time_out: time | None = None
    hours: Decimal
    hourly_rate: Decimal
    notes: str | None = None


class TimeEntryCreate(TimeEntryBase):
    pay_period_id: int | None = None  # Will be inferred from date if not provided

    @field_validator('hours')
    @classmethod
    def hours_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('hours must be positive')
        if v > 24:
            raise ValueError('hours cannot exceed 24')
        return v


class TimeEntryUpdate(BaseModel):
    time_in: time | None = None
    time_out: time | None = None
    hours: Decimal | None = None
    hourly_rate: Decimal | None = None
    notes: str | None = None


class TimeEntryResponse(TimeEntryBase):
    id: int
    pay_period_id: int
    total_pay: Decimal
    created_at: datetime
    caregiver_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class TimeEntryBulkCreate(BaseModel):
    entries: list[TimeEntryCreate]
```

Update `backend/app/schemas/__init__.py`:
```python
from app.schemas.caregiver import (
    CaregiverBase, CaregiverCreate, CaregiverUpdate, CaregiverResponse
)
from app.schemas.pay_period import (
    PayPeriodBase, PayPeriodCreate, PayPeriodUpdate, PayPeriodResponse
)
from app.schemas.time_entry import (
    TimeEntryBase, TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse,
    TimeEntryBulkCreate
)

__all__ = [
    "CaregiverBase", "CaregiverCreate", "CaregiverUpdate", "CaregiverResponse",
    "PayPeriodBase", "PayPeriodCreate", "PayPeriodUpdate", "PayPeriodResponse",
    "TimeEntryBase", "TimeEntryCreate", "TimeEntryUpdate", "TimeEntryResponse",
    "TimeEntryBulkCreate",
]
```

**Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for TimeEntry"
```

---

### Task 4.2: Create TimeEntry CRUD Routes

**Files:**
- Create: `backend/app/api/routes/time_entries.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:
```python
def test_create_time_entry(client):
    # Setup: create caregiver and period
    cg_response = client.post("/api/caregivers", json={"name": "Julia"})
    caregiver_id = cg_response.json()["id"]

    period_response = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    )
    period_id = period_response.json()["id"]

    # Create time entry
    response = client.post(
        "/api/time-entries",
        json={
            "caregiver_id": caregiver_id,
            "pay_period_id": period_id,
            "date": "2026-01-15",
            "hours": "12.00",
            "hourly_rate": "15.00"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["hours"] == "12.00"
    assert data["total_pay"] == "180.00"


def test_list_time_entries_by_period(client):
    # Setup
    cg = client.post("/api/caregivers", json={"name": "Diana"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Create entries
    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    })
    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "hours": "10.00",
        "hourly_rate": "15.00"
    })

    response = client.get(f"/api/time-entries?period_id={period['id']}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_time_entry(client):
    cg = client.post("/api/caregivers", json={"name": "Edwina"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    entry = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    response = client.put(
        f"/api/time-entries/{entry['id']}",
        json={"hours": "10.00"}
    )
    assert response.status_code == 200
    assert response.json()["hours"] == "10.00"
    assert response.json()["total_pay"] == "150.00"


def test_delete_time_entry(client):
    cg = client.post("/api/caregivers", json={"name": "Margaret"}).json()
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    entry = client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "8.00",
        "hourly_rate": "15.00"
    }).json()

    response = client.delete(f"/api/time-entries/{entry['id']}")
    assert response.status_code == 204

    # Verify deleted
    get_response = client.get(f"/api/time-entries/{entry['id']}")
    assert get_response.status_code == 404
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_api.py::test_create_time_entry -v
# Expected: FAIL - 404 Not Found
```

**Step 3: Create time_entries routes**

Create `backend/app/api/routes/time_entries.py`:
```python
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
        # Reuse single create logic
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
```

**Step 4: Register router in main.py**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers, pay_periods, time_entries


@asynccontextmanager
async def lifespan(app: FastAPI):
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(caregivers.router)
app.include_router(pay_periods.router)
app.include_router(time_entries.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add TimeEntry CRUD API with bulk create support"
```

---

## Phase 5: Expense API

### Task 5.1: Create Expense Schemas

**Files:**
- Create: `backend/app/schemas/expense.py`
- Modify: `backend/app/schemas/__init__.py`

**Step 1: Create schemas**

Create `backend/app/schemas/expense.py`:
```python
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.expense import Payer, ExpenseCategory


class ExpenseBase(BaseModel):
    date: date
    description: str
    amount: Decimal
    paid_by: Payer
    category: ExpenseCategory
    is_recurring: bool = False
    notes: str | None = None


class ExpenseCreate(ExpenseBase):
    pay_period_id: int | None = None

    @field_validator('amount')
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('amount must be positive')
        return v


class ExpenseUpdate(BaseModel):
    date: date | None = None
    description: str | None = None
    amount: Decimal | None = None
    paid_by: Payer | None = None
    category: ExpenseCategory | None = None
    is_recurring: bool | None = None
    notes: str | None = None


class ExpenseResponse(ExpenseBase):
    id: int
    pay_period_id: int
    date_estimated: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ExpenseSummary(BaseModel):
    adi_total: Decimal
    rafi_total: Decimal
    by_category: dict[str, Decimal]
```

Update `backend/app/schemas/__init__.py`:
```python
from app.schemas.caregiver import (
    CaregiverBase, CaregiverCreate, CaregiverUpdate, CaregiverResponse
)
from app.schemas.pay_period import (
    PayPeriodBase, PayPeriodCreate, PayPeriodUpdate, PayPeriodResponse
)
from app.schemas.time_entry import (
    TimeEntryBase, TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse,
    TimeEntryBulkCreate
)
from app.schemas.expense import (
    ExpenseBase, ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary
)

__all__ = [
    "CaregiverBase", "CaregiverCreate", "CaregiverUpdate", "CaregiverResponse",
    "PayPeriodBase", "PayPeriodCreate", "PayPeriodUpdate", "PayPeriodResponse",
    "TimeEntryBase", "TimeEntryCreate", "TimeEntryUpdate", "TimeEntryResponse",
    "TimeEntryBulkCreate",
    "ExpenseBase", "ExpenseCreate", "ExpenseUpdate", "ExpenseResponse", "ExpenseSummary",
]
```

**Step 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for Expense"
```

---

### Task 5.2: Create Expense CRUD Routes

**Files:**
- Create: `backend/app/api/routes/expenses.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Step 1: Write the failing test**

Add to `backend/tests/test_api.py`:
```python
def test_create_expense(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    response = client.post(
        "/api/expenses",
        json={
            "pay_period_id": period["id"],
            "date": "2026-01-15",
            "description": "Walmart groceries",
            "amount": "209.71",
            "paid_by": "Rafi",
            "category": "Groceries"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == "Walmart groceries"
    assert data["amount"] == "209.71"
    assert data["paid_by"] == "Rafi"


def test_list_expenses_by_period(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Rent",
        "amount": "800.00",
        "paid_by": "Rafi",
        "category": "Rent"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "FPL",
        "amount": "164.14",
        "paid_by": "Rafi",
        "category": "Utilities"
    })

    response = client.get(f"/api/expenses?period_id={period['id']}")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_expense_summary(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Rent",
        "amount": "800.00",
        "paid_by": "Rafi",
        "category": "Rent"
    })
    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-16",
        "description": "Medical",
        "amount": "85.00",
        "paid_by": "Adi",
        "category": "Medical"
    })

    response = client.get(f"/api/expenses/summary?period_id={period['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["rafi_total"] == "800.00"
    assert data["adi_total"] == "85.00"
```

**Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_api.py::test_create_expense -v
# Expected: FAIL - 404 Not Found
```

**Step 3: Create expenses routes**

Create `backend/app/api/routes/expenses.py`:
```python
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.expense import Expense, Payer, ExpenseCategory
from app.models.pay_period import PayPeriod
from app.schemas.expense import (
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary
)

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
```

**Step 4: Register router in main.py**

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers, pay_periods, time_entries, expenses


@asynccontextmanager
async def lifespan(app: FastAPI):
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(caregivers.router)
app.include_router(pay_periods.router)
app.include_router(time_entries.router)
app.include_router(expenses.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_api.py -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add Expense CRUD API with summary endpoint"
```

---

## Phase 6: Settlement Calculator

### Task 6.1: Create Settlement Service

**Files:**
- Create: `backend/app/services/settlement_calculator.py`
- Create: `backend/tests/test_settlement.py`

**Step 1: Write the failing test**

Create `backend/tests/test_settlement.py`:
```python
import pytest
from decimal import Decimal
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models import Caregiver, PayPeriod, TimeEntry, Expense, Settlement, PeriodStatus
from app.models.expense import Payer, ExpenseCategory
from app.services.settlement_calculator import calculate_settlement


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_calculate_settlement_rafi_owes_adi(db_session):
    # Setup: Adi paid more
    caregiver = Caregiver(name="Julia", default_hourly_rate=15)
    db_session.add(caregiver)

    period = PayPeriod(
        start_date=date(2026, 1, 13),
        end_date=date(2026, 1, 26),
        status=PeriodStatus.OPEN
    )
    db_session.add(period)
    db_session.commit()

    # Julia worked 48 hours = $720
    entry = TimeEntry(
        pay_period_id=period.id,
        caregiver_id=caregiver.id,
        date=date(2026, 1, 15),
        hours=Decimal("48"),
        hourly_rate=Decimal("15"),
        total_pay=Decimal("720")
    )
    db_session.add(entry)

    # Adi paid Julia $720 + $100 groceries = $820
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Julia payment",
        amount=Decimal("720"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.CAREGIVER_PAYMENT
    ))
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 16),
        description="Groceries",
        amount=Decimal("100"),
        paid_by=Payer.ADI,
        category=ExpenseCategory.GROCERIES
    ))

    # Rafi paid $200 rent
    db_session.add(Expense(
        pay_period_id=period.id,
        date=date(2026, 1, 15),
        description="Rent",
        amount=Decimal("200"),
        paid_by=Payer.RAFI,
        category=ExpenseCategory.RENT
    ))
    db_session.commit()

    # Total: $720 caregiver + $1020 expenses = $1740 (wait, let me recalculate)
    # Actually: caregiver cost = $720, expenses = $100 + $200 + $720 = $1020
    # Total cost = $720 + $100 + $200 = $1020 (caregiver payment is part of expenses)
    # Fair share = $510 each
    # Adi paid: $820, Rafi paid: $200
    # Adi overpaid by $310, so Rafi owes Adi $310

    result = calculate_settlement(db_session, period.id)

    assert result.total_caregiver_cost == Decimal("720")
    assert result.adi_paid == Decimal("820")
    assert result.rafi_paid == Decimal("200")
    assert result.settlement_direction.value == "rafi_owes_adi"
    assert result.settlement_amount == Decimal("310")
```

**Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/test_settlement.py -v
# Expected: FAIL - ModuleNotFoundError
```

**Step 3: Create settlement calculator service**

Create `backend/app/services/settlement_calculator.py`:
```python
from decimal import Decimal
from sqlalchemy.orm import Session

from app.models import TimeEntry, Expense, Settlement, PayPeriod
from app.models.expense import Payer
from app.models.settlement import SettlementDirection


def calculate_settlement(db: Session, period_id: int) -> Settlement:
    """
    Calculate the settlement for a pay period.

    Settlement formula:
    1. Total cost = sum of all time entry pay + sum of all expenses
       (but caregiver payments in expenses are already included in time entries,
        so we use expenses only for the split calculation)
    2. Fair share = total expenses / 2
    3. Settlement = who paid more - fair share
    """
    # Get all time entries for the period
    time_entries = db.query(TimeEntry).filter(
        TimeEntry.pay_period_id == period_id
    ).all()

    # Get all expenses for the period
    expenses = db.query(Expense).filter(
        Expense.pay_period_id == period_id
    ).all()

    # Calculate totals
    total_caregiver_cost = sum(e.total_pay for e in time_entries)
    total_expenses = sum(e.amount for e in expenses)

    # What each person paid
    adi_paid = sum(e.amount for e in expenses if e.paid_by == Payer.ADI)
    rafi_paid = sum(e.amount for e in expenses if e.paid_by == Payer.RAFI)

    # Total cost is just the expenses (caregiver payments are expenses)
    total_cost = total_expenses
    fair_share = total_cost / 2

    # Determine settlement
    if adi_paid > fair_share:
        settlement_amount = adi_paid - fair_share
        direction = SettlementDirection.RAFI_OWES_ADI
    elif rafi_paid > fair_share:
        settlement_amount = rafi_paid - fair_share
        direction = SettlementDirection.ADI_OWES_RAFI
    else:
        settlement_amount = Decimal("0")
        direction = SettlementDirection.EVEN

    # Round to 2 decimal places
    settlement_amount = settlement_amount.quantize(Decimal("0.01"))

    # Check for existing settlement
    existing = db.query(Settlement).filter(
        Settlement.pay_period_id == period_id
    ).first()

    if existing:
        # Update existing
        existing.total_caregiver_cost = total_caregiver_cost
        existing.total_expenses = total_expenses
        existing.adi_paid = adi_paid
        existing.rafi_paid = rafi_paid
        existing.settlement_amount = settlement_amount
        existing.settlement_direction = direction
        existing.final_amount = settlement_amount + existing.carryover_amount
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        settlement = Settlement(
            pay_period_id=period_id,
            total_caregiver_cost=total_caregiver_cost,
            total_expenses=total_expenses,
            adi_paid=adi_paid,
            rafi_paid=rafi_paid,
            settlement_amount=settlement_amount,
            settlement_direction=direction,
            carryover_amount=Decimal("0"),
            final_amount=settlement_amount
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)
        return settlement
```

**Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/test_settlement.py -v
# Expected: PASSED
```

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: add settlement calculator service with 50/50 split logic"
```

---

### Task 6.2: Create Settlement API Routes

**Files:**
- Create: `backend/app/schemas/settlement.py`
- Create: `backend/app/api/routes/settlements.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Step 1: Create schemas**

Create `backend/app/schemas/settlement.py`:
```python
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict

from app.models.settlement import SettlementDirection


class SettlementResponse(BaseModel):
    id: int
    pay_period_id: int
    total_caregiver_cost: Decimal
    total_expenses: Decimal
    adi_paid: Decimal
    rafi_paid: Decimal
    settlement_amount: Decimal
    settlement_direction: SettlementDirection
    carryover_amount: Decimal
    final_amount: Decimal
    settled: bool
    settled_at: datetime | None
    payment_method: str | None

    model_config = ConfigDict(from_attributes=True)


class MarkSettledRequest(BaseModel):
    payment_method: str | None = None
```

Update `backend/app/schemas/__init__.py` to include settlement schemas.

**Step 2: Write the failing test**

Add to `backend/tests/test_api.py`:
```python
def test_get_settlement(client):
    # Setup period with data
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    cg = client.post("/api/caregivers", json={"name": "Julia"}).json()

    client.post("/api/time-entries", json={
        "caregiver_id": cg["id"],
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "hours": "12.00",
        "hourly_rate": "15.00"
    })

    client.post("/api/expenses", json={
        "pay_period_id": period["id"],
        "date": "2026-01-15",
        "description": "Julia payment",
        "amount": "180.00",
        "paid_by": "Adi",
        "category": "Caregiver Payment"
    })

    response = client.get(f"/api/settlements/{period['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["total_caregiver_cost"] == "180.00"
    assert data["adi_paid"] == "180.00"
    assert data["rafi_paid"] == "0.00"


def test_mark_settled(client):
    period = client.post(
        "/api/pay-periods",
        json={"start_date": "2026-01-13", "end_date": "2026-01-26"}
    ).json()

    # Get settlement first (creates it)
    client.get(f"/api/settlements/{period['id']}")

    # Mark as settled
    response = client.post(
        f"/api/settlements/{period['id']}/mark-settled",
        json={"payment_method": "Venmo"}
    )
    assert response.status_code == 200
    assert response.json()["settled"] is True
    assert response.json()["payment_method"] == "Venmo"
```

**Step 3: Create settlements routes**

Create `backend/app/api/routes/settlements.py`:
```python
from datetime import datetime
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
    settlement = db.query(Settlement).filter(
        Settlement.pay_period_id == period_id
    ).first()

    if not settlement:
        # Create settlement first
        settlement = calculate_settlement(db, period_id)

    settlement.settled = True
    settlement.settled_at = datetime.utcnow()
    settlement.payment_method = request.payment_method

    db.commit()
    db.refresh(settlement)
    return settlement
```

**Step 4: Register router and update schemas**

Update `backend/app/schemas/__init__.py`:
```python
from app.schemas.caregiver import (
    CaregiverBase, CaregiverCreate, CaregiverUpdate, CaregiverResponse
)
from app.schemas.pay_period import (
    PayPeriodBase, PayPeriodCreate, PayPeriodUpdate, PayPeriodResponse
)
from app.schemas.time_entry import (
    TimeEntryBase, TimeEntryCreate, TimeEntryUpdate, TimeEntryResponse,
    TimeEntryBulkCreate
)
from app.schemas.expense import (
    ExpenseBase, ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary
)
from app.schemas.settlement import (
    SettlementResponse, MarkSettledRequest
)

__all__ = [
    "CaregiverBase", "CaregiverCreate", "CaregiverUpdate", "CaregiverResponse",
    "PayPeriodBase", "PayPeriodCreate", "PayPeriodUpdate", "PayPeriodResponse",
    "TimeEntryBase", "TimeEntryCreate", "TimeEntryUpdate", "TimeEntryResponse",
    "TimeEntryBulkCreate",
    "ExpenseBase", "ExpenseCreate", "ExpenseUpdate", "ExpenseResponse", "ExpenseSummary",
    "SettlementResponse", "MarkSettledRequest",
]
```

Update `backend/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, import_models
from app.api.routes import caregivers, pay_periods, time_entries, expenses, settlements


@asynccontextmanager
async def lifespan(app: FastAPI):
    import_models()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(caregivers.router)
app.include_router(pay_periods.router)
app.include_router(time_entries.router)
app.include_router(expenses.router)
app.include_router(settlements.router)


@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Step 5: Run all tests**

```bash
cd backend && python -m pytest tests/ -v
# Expected: All tests PASSED
```

**Step 6: Commit**

```bash
git add backend/
git commit -m "feat: add Settlement API with calculate and mark-settled endpoints"
```

---

## Phase 7: Frontend Setup

### Task 7.1: Initialize React Project

**Files:**
- Create: `frontend/` directory with Vite + React + TypeScript

**Step 1: Create React project with Vite**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

**Step 2: Install dependencies**

```bash
cd frontend && npm install @tanstack/react-query axios react-router-dom @hookform/resolvers zod react-hook-form
npm install -D tailwindcss postcss autoprefixer @types/react-router-dom
npx tailwindcss init -p
```

**Step 3: Configure Tailwind**

Update `frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Update `frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Verify it runs**

```bash
cd frontend && npm run dev &
sleep 3
curl -s http://localhost:5173 | head -5
# Expected: HTML content
pkill -f "vite"
```

**Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: initialize React frontend with Vite, TypeScript, and Tailwind"
```

---

### Task 7.2: Install and Configure shadcn/ui

**Files:**
- Modify: `frontend/` configuration files
- Create: `frontend/src/components/ui/` directory

**Step 1: Initialize shadcn/ui**

```bash
cd frontend && npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 2: Add common components**

```bash
cd frontend && npx shadcn@latest add button card input label select table dialog form toast
```

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: add shadcn/ui components"
```

---

### Task 7.3: Create API Client and Types

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/types/index.ts`

**Step 1: Create TypeScript types**

Create `frontend/src/types/index.ts`:
```typescript
export interface Caregiver {
  id: number;
  name: string;
  default_hourly_rate: string;
  is_active: boolean;
  created_at: string;
}

export interface PayPeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  is_historical: boolean;
  notes: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  pay_period_id: number;
  caregiver_id: number;
  date: string;
  time_in: string | null;
  time_out: string | null;
  hours: string;
  hourly_rate: string;
  total_pay: string;
  notes: string | null;
  caregiver_name?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  pay_period_id: number;
  date: string;
  description: string;
  amount: string;
  paid_by: 'Adi' | 'Rafi';
  category: ExpenseCategory;
  is_recurring: boolean;
  date_estimated: boolean;
  notes: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Utilities'
  | 'Groceries'
  | 'Medical'
  | 'Caregiver Payment'
  | 'Insurance'
  | 'Supplies'
  | 'Other';

export interface Settlement {
  id: number;
  pay_period_id: number;
  total_caregiver_cost: string;
  total_expenses: string;
  adi_paid: string;
  rafi_paid: string;
  settlement_amount: string;
  settlement_direction: 'adi_owes_rafi' | 'rafi_owes_adi' | 'even';
  carryover_amount: string;
  final_amount: string;
  settled: boolean;
  settled_at: string | null;
  payment_method: string | null;
}

export interface ExpenseSummary {
  adi_total: string;
  rafi_total: string;
  by_category: Record<string, string>;
}
```

**Step 2: Create API client**

Create `frontend/src/lib/api.ts`:
```typescript
import axios from 'axios';
import type {
  Caregiver,
  PayPeriod,
  TimeEntry,
  Expense,
  Settlement,
  ExpenseSummary,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Caregivers
export const caregivers = {
  list: () => api.get<Caregiver[]>('/api/caregivers').then((r) => r.data),
  get: (id: number) => api.get<Caregiver>(`/api/caregivers/${id}`).then((r) => r.data),
  create: (data: Partial<Caregiver>) =>
    api.post<Caregiver>('/api/caregivers', data).then((r) => r.data),
  update: (id: number, data: Partial<Caregiver>) =>
    api.put<Caregiver>(`/api/caregivers/${id}`, data).then((r) => r.data),
  deactivate: (id: number) =>
    api.delete<Caregiver>(`/api/caregivers/${id}`).then((r) => r.data),
};

// Pay Periods
export const payPeriods = {
  list: () => api.get<PayPeriod[]>('/api/pay-periods').then((r) => r.data),
  current: () => api.get<PayPeriod>('/api/pay-periods/current').then((r) => r.data),
  get: (id: number) => api.get<PayPeriod>(`/api/pay-periods/${id}`).then((r) => r.data),
  create: (data: { start_date: string; end_date: string; notes?: string }) =>
    api.post<PayPeriod>('/api/pay-periods', data).then((r) => r.data),
  close: (id: number) =>
    api.post<PayPeriod>(`/api/pay-periods/${id}/close`).then((r) => r.data),
};

// Time Entries
export const timeEntries = {
  list: (periodId?: number) =>
    api
      .get<TimeEntry[]>('/api/time-entries', { params: { period_id: periodId } })
      .then((r) => r.data),
  get: (id: number) => api.get<TimeEntry>(`/api/time-entries/${id}`).then((r) => r.data),
  create: (data: Partial<TimeEntry>) =>
    api.post<TimeEntry>('/api/time-entries', data).then((r) => r.data),
  update: (id: number, data: Partial<TimeEntry>) =>
    api.put<TimeEntry>(`/api/time-entries/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/time-entries/${id}`),
};

// Expenses
export const expenses = {
  list: (periodId?: number) =>
    api
      .get<Expense[]>('/api/expenses', { params: { period_id: periodId } })
      .then((r) => r.data),
  summary: (periodId: number) =>
    api
      .get<ExpenseSummary>('/api/expenses/summary', { params: { period_id: periodId } })
      .then((r) => r.data),
  get: (id: number) => api.get<Expense>(`/api/expenses/${id}`).then((r) => r.data),
  create: (data: Partial<Expense>) =>
    api.post<Expense>('/api/expenses', data).then((r) => r.data),
  update: (id: number, data: Partial<Expense>) =>
    api.put<Expense>(`/api/expenses/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/expenses/${id}`),
};

// Settlements
export const settlements = {
  get: (periodId: number) =>
    api.get<Settlement>(`/api/settlements/${periodId}`).then((r) => r.data),
  calculate: (periodId: number) =>
    api.post<Settlement>(`/api/settlements/${periodId}/calculate`).then((r) => r.data),
  markSettled: (periodId: number, paymentMethod?: string) =>
    api
      .post<Settlement>(`/api/settlements/${periodId}/mark-settled`, {
        payment_method: paymentMethod,
      })
      .then((r) => r.data),
};

export default api;
```

**Step 3: Commit**

```bash
git add frontend/src/
git commit -m "feat: add TypeScript types and API client for all endpoints"
```

---

This plan continues with Tasks 7.4-7.12 for the remaining frontend pages (Dashboard, Time Entries, Expenses, etc.), Phase 8 for the Excel import feature, and Phase 9 for Docker deployment. The pattern remains the same: write failing test → implement → verify → commit.

---

## Remaining Tasks (Summary)

### Phase 7 (continued): Frontend Pages
- **Task 7.4**: Create layout components (Sidebar, Header)
- **Task 7.5**: Create Dashboard page with settlement widget
- **Task 7.6**: Create Time Entries page with quick-add form
- **Task 7.7**: Create Expenses page with running totals
- **Task 7.8**: Create Period Summary page
- **Task 7.9**: Create Caregivers management page
- **Task 7.10**: Create React Query hooks for data fetching
- **Task 7.11**: Set up React Router with all pages
- **Task 7.12**: Add responsive styling for mobile

### Phase 8: Excel Import
- **Task 8.1**: Create Excel parser service
- **Task 8.2**: Create import API endpoints
- **Task 8.3**: Create import wizard UI
- **Task 8.4**: Test import with actual caregiver.xlsx

### Phase 9: Docker & Deployment
- **Task 9.1**: Create backend Dockerfile
- **Task 9.2**: Create frontend Dockerfile
- **Task 9.3**: Create docker-compose.yml
- **Task 9.4**: Add backup script
- **Task 9.5**: Write README with setup instructions

---

**Plan complete and saved to `docs/plans/2026-01-29-caregiver-tracker-implementation.md`.**

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open a new session with the executing-plans skill, batch execution with checkpoints

**Which approach?**
