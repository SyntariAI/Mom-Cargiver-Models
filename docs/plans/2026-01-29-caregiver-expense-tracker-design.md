# Caregiver & Expense Tracking Dashboard - Design Document

**Date:** January 29, 2026
**Status:** Approved
**Author:** Rafi & Claude

---

## Overview

A full-stack web application for tracking caregiver hours and shared family expenses for mom's care. Rafi and Adi split all costs 50/50. The app calculates settlements at the end of each bi-weekly pay period.

### Key Goals
- Log caregiver shifts (multiple caregivers, varying hours and rates)
- Track expenses paid by either Adi or Rafi
- Calculate who owes whom at each period end
- Track running balances across periods
- Import 2 years of historical data from Excel

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui |
| State | React Query (server state), React Hook Form + Zod (forms) |
| Backend | Python FastAPI, SQLAlchemy ORM |
| Database | SQLite (single file, easy backup) |
| Deployment | Docker Compose (local-first, deploy anywhere) |

---

## Project Structure

```
mom-caregiver/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── caregivers.py
│   │   │       ├── pay_periods.py
│   │   │       ├── time_entries.py
│   │   │       ├── expenses.py
│   │   │       ├── settlements.py
│   │   │       ├── analytics.py
│   │   │       ├── import_data.py
│   │   │       └── share.py
│   │   ├── models/
│   │   │   ├── caregiver.py
│   │   │   ├── pay_period.py
│   │   │   ├── time_entry.py
│   │   │   ├── expense.py
│   │   │   ├── settlement.py
│   │   │   ├── shift_template.py
│   │   │   └── recurring_expense.py
│   │   ├── schemas/
│   │   │   └── (Pydantic schemas matching models)
│   │   ├── services/
│   │   │   ├── settlement_calculator.py
│   │   │   ├── natural_language_parser.py
│   │   │   ├── period_carryforward.py
│   │   │   └── excel_importer.py
│   │   └── core/
│   │       ├── config.py
│   │       ├── database.py
│   │       └── security.py
│   ├── alembic/
│   │   └── versions/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/              # shadcn components
│   │   │   ├── layout/          # Sidebar, Header
│   │   │   ├── dashboard/       # Dashboard widgets
│   │   │   ├── time-entries/    # Calendar, EntryForm, BulkEntry
│   │   │   ├── expenses/        # ExpenseForm, ExpenseTable
│   │   │   ├── settlement/      # SettlementCard, SettlementBreakdown
│   │   │   └── analytics/       # Charts, Filters
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── TimeEntries.tsx
│   │   │   ├── Expenses.tsx
│   │   │   ├── PeriodSummary.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── Caregivers.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── SharedView.tsx   # Read-only for Adi
│   │   ├── hooks/
│   │   │   ├── useCaregivers.ts
│   │   │   ├── usePayPeriods.ts
│   │   │   ├── useTimeEntries.ts
│   │   │   ├── useExpenses.ts
│   │   │   └── useSettlement.ts
│   │   ├── lib/
│   │   │   ├── api.ts           # API client
│   │   │   ├── utils.ts
│   │   │   └── natural-language.ts
│   │   └── types/
│   │       └── index.ts
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml
├── data/
│   ├── caregiver.db            # SQLite database
│   └── backups/                # Daily backups
└── README.md
```

---

## Data Models

### caregivers
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | VARCHAR(100) | Unique |
| default_hourly_rate | DECIMAL(10,2) | Default $15 |
| is_active | BOOLEAN | Default true |
| created_at | TIMESTAMP | |

### pay_periods
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| start_date | DATE | Monday |
| end_date | DATE | Sunday (13 days later) |
| status | ENUM | 'open', 'closed' |
| is_historical | BOOLEAN | True for imported data |
| notes | TEXT | |
| created_at | TIMESTAMP | |

### time_entries
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| pay_period_id | INTEGER | FK → pay_periods |
| caregiver_id | INTEGER | FK → caregivers |
| date | DATE | |
| time_in | TIME | Nullable (can enter hours directly) |
| time_out | TIME | Nullable |
| hours | DECIMAL(5,2) | Calculated or manual |
| hourly_rate | DECIMAL(10,2) | Snapshot from caregiver |
| total_pay | DECIMAL(10,2) | hours × hourly_rate |
| notes | TEXT | |
| created_at | TIMESTAMP | |

### expenses
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| pay_period_id | INTEGER | FK → pay_periods |
| date | DATE | |
| description | VARCHAR(255) | |
| amount | DECIMAL(10,2) | |
| paid_by | ENUM | 'Adi', 'Rafi' |
| category | ENUM | 'Rent', 'Utilities', 'Groceries', 'Medical', 'Caregiver Payment', 'Insurance', 'Supplies', 'Other' |
| is_recurring | BOOLEAN | Default false |
| date_estimated | BOOLEAN | True for imported Adi expenses |
| notes | TEXT | |
| created_at | TIMESTAMP | |

### settlements
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| pay_period_id | INTEGER | FK → pay_periods (unique) |
| total_caregiver_cost | DECIMAL(10,2) | |
| total_expenses | DECIMAL(10,2) | |
| adi_paid | DECIMAL(10,2) | Expenses + caregiver payments |
| rafi_paid | DECIMAL(10,2) | Expenses + caregiver payments |
| settlement_amount | DECIMAL(10,2) | Absolute difference |
| settlement_direction | ENUM | 'adi_owes_rafi', 'rafi_owes_adi', 'even' |
| carryover_amount | DECIMAL(10,2) | From previous unsettled |
| final_amount | DECIMAL(10,2) | settlement + carryover |
| settled | BOOLEAN | |
| settled_at | TIMESTAMP | |
| payment_method | VARCHAR(50) | 'Venmo', 'Zelle', 'Cash', etc. |

### shift_templates
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| name | VARCHAR(100) | e.g., "Julia overnight" |
| caregiver_id | INTEGER | FK → caregivers |
| default_start | TIME | e.g., 19:00 |
| default_end | TIME | e.g., 07:00 |
| default_hours | DECIMAL(5,2) | e.g., 12 |

### recurring_expenses
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| description | VARCHAR(255) | e.g., "Rent" |
| default_amount | DECIMAL(10,2) | |
| paid_by | ENUM | 'Adi', 'Rafi' |
| category | ENUM | |
| is_active | BOOLEAN | |

### share_tokens
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER | Primary key |
| token | VARCHAR(64) | Unique, random |
| pin | VARCHAR(4) | Optional |
| created_at | TIMESTAMP | |
| expires_at | TIMESTAMP | Nullable |

---

## API Endpoints

### Caregivers
```
GET    /api/caregivers              # List all caregivers
POST   /api/caregivers              # Create caregiver
PUT    /api/caregivers/{id}         # Update caregiver
DELETE /api/caregivers/{id}         # Deactivate caregiver
```

### Pay Periods
```
GET    /api/pay-periods                           # List all periods
GET    /api/pay-periods/current                   # Get current open period
POST   /api/pay-periods                           # Create new period
PUT    /api/pay-periods/{id}                      # Update period
POST   /api/pay-periods/{id}/close                # Close period
POST   /api/pay-periods/{id}/copy-from/{source}   # Copy schedule from another period
```

### Time Entries
```
GET    /api/time-entries?period_id={id}    # List entries for period
POST   /api/time-entries                    # Create entry
POST   /api/time-entries/bulk               # Create multiple entries
PUT    /api/time-entries/{id}               # Update entry
DELETE /api/time-entries/{id}               # Delete entry
POST   /api/time-entries/parse              # Parse natural language input
```

### Expenses
```
GET    /api/expenses?period_id={id}    # List expenses for period
POST   /api/expenses                    # Create expense
PUT    /api/expenses/{id}               # Update expense
DELETE /api/expenses/{id}               # Delete expense
GET    /api/expenses/recurring          # List recurring expense templates
POST   /api/expenses/apply-recurring    # Apply recurring expenses to period
```

### Settlements
```
GET    /api/settlements/{period_id}              # Get settlement for period
POST   /api/settlements/{period_id}/calculate    # Recalculate settlement
POST   /api/settlements/{period_id}/mark-settled # Mark as settled
GET    /api/settlements/balance                  # Get running lifetime balance
```

### Analytics
```
GET    /api/analytics/spending?start={date}&end={date}
GET    /api/analytics/by-category?start={date}&end={date}
GET    /api/analytics/by-caregiver?start={date}&end={date}
GET    /api/analytics/coverage?period_id={id}
GET    /api/analytics/export?format=csv&start={date}&end={date}
GET    /api/analytics/tax-report?year={year}
```

### Import
```
POST   /api/import/excel          # Upload and parse Excel file
GET    /api/import/preview/{id}   # Preview parsed data before confirming
POST   /api/import/confirm/{id}   # Confirm and import data
```

### Sharing
```
POST   /api/share/generate        # Generate new share token
GET    /api/share/{token}         # Validate token (with optional PIN)
GET    /api/share/{token}/data    # Get read-only data for shared view
DELETE /api/share/{token}         # Revoke share token
```

---

## UI Pages

### 1. Dashboard
- Current period summary card (dates, status, days remaining)
- **Settlement widget** (always visible): color-coded "Rafi owes Adi $484.32"
- Quick stats: total hours, total cost, breakdown by caregiver
- Recent activity feed (last 5 entries combined)
- Quick action buttons: Add Shift, Add Expense, View Summary
- Period history cards (last 3 closed periods)

### 2. Time Entries
- **Calendar view** (default): 2-week grid, colored blocks per caregiver
- **List view** toggle: sortable table with inline editing
- **Quick-add bar**: Caregiver → Date → Hours/Time → Add
- **Natural language input**: "Julia Mon-Thu nights this week"
- **Bulk entry modal**: Multi-day entry form
- **Template sidebar**: Saved shift patterns, drag to calendar
- **Summary footer**: Hours and pay per caregiver

### 3. Expenses
- Add form: Date, Description, Amount, Paid By toggle, Category dropdown
- Recurring checkbox
- Expense table with inline editing (double-click)
- Filter by category, payer
- Running totals bar: "Adi: $1,240 | Rafi: $856 | Diff: +$384 Adi"

### 4. Period Summary
- Detailed breakdown:
  - Caregiver costs table (per caregiver subtotals)
  - Expenses by category
  - Who paid whom for caregiver payments
- Settlement calculation with step-by-step math
- Carryover from previous period (if any)
- Final settlement amount with direction
- Mark as Settled button (records date + method)
- Export PDF / Share link buttons

### 5. Analytics
- **Spending trend**: Line chart over time
- **Category breakdown**: Pie chart
- **Caregiver hours**: Stacked bar chart
- **Settlement history**: Bar chart (positive = Adi owes, negative = Rafi owes)
- **Coverage heatmap**: Hour-by-day grid showing coverage
- Filters: Date range, caregiver, category
- Export CSV button
- Tax report section (annual totals)

### 6. Caregivers
- Card grid of caregivers with photo placeholder, name, rate
- Add/Edit modal
- Deactivate toggle (soft delete)
- Per-caregiver stats: total hours all-time, total pay, periods worked

### 7. Settings
- **Shift templates**: Manage saved patterns
- **Recurring expenses**: Manage auto-suggested expenses
- **Share settings**: Generate/revoke Adi's read-only link
- **Notifications**: Toggle reminder preferences
- **Data**: Export all data, backup database

### 8. Shared View (Adi's read-only)
- Simplified dashboard
- Current period summary
- Full history browser
- No edit capabilities

---

## Natural Language Parser

Rule-based parser for time entry input. Runs client-side with server validation.

### Patterns Recognized

| Pattern | Example | Result |
|---------|---------|--------|
| Caregiver + day + "night" | "Julia Monday night" | Julia, Monday, 7pm-7am, 12h |
| Caregiver + day range + "nights" | "Julia Mon-Thu nights" | 4 entries, Mon-Thu, 12h each |
| Caregiver + time range + day | "Diana 2pm-7pm yesterday" | Diana, yesterday, 5h |
| Caregiver + hours + day | "Edwina 8 hours Friday" | Edwina, Friday, 8h |
| "same as last week" | | Copy all entries from -7 days |
| "same as last period" | | Copy all entries from previous period |
| Caregiver + "didn't work" + day | "Julia didn't work Tuesday" | Delete Julia's Tuesday entry |

### Parser Logic

```python
def parse_natural_language(input: str, context: ParserContext) -> ParseResult:
    # 1. Tokenize and normalize
    # 2. Extract caregiver name (fuzzy match against known names)
    # 3. Extract date references (today, yesterday, Monday, last Friday, etc.)
    # 4. Extract time patterns (7pm-7am, overnight, morning, afternoon)
    # 5. Extract hour amounts (8 hours, 8hrs, 8h)
    # 6. Detect modifiers (same as, didn't work, skip)
    # 7. Apply defaults from templates if partial info
    # 8. Return structured result with confidence score
```

Shows preview before committing with Confirm/Edit/Cancel options.

---

## Carryforward System

### Schedule Carryforward
When creating a new period, option to "Copy from last period":
1. Show list of all shifts from previous period
2. Checkboxes to include/exclude each
3. Adjust dates to new period (same day-of-week)
4. Creates entries with same caregiver, hours, rate

### Recurring Expenses
- Mark any expense as "recurring"
- When starting new period, show suggestions panel
- One-click to add at last amount, or edit first
- Smart detection: "Rent has been $800 for 6 periods. Add as recurring?"

### Shift Templates
- Save common patterns: "Julia overnight" = 7pm-7am, 12h, $15
- Drag template onto calendar date
- Or select from quick-add dropdown

### Balance Carryforward
- If period closes without marking settled, balance carries
- Settlement shows: "Previous balance: +$52 → Final: $498.93"
- Lifetime running balance tracked

---

## Historical Data Import

### Source Data (Excel)
- **Caregivers sheet**: 9 caregivers, direct import
- **Time entries sheet**: 721 entries, Jan 2024 - Jan 2026
- **Expenses sheet**: 293 entries, no dates

### Import Strategy

1. **Caregivers**: Direct import, match by name
2. **Pay periods**: Generate bi-weekly periods starting Jan 1, 2024 (every other Monday)
3. **Time entries**:
   - Parse date column
   - Assign to appropriate period based on date
   - Import hours and pay directly (time_in/time_out often null)
4. **Rafi expenses (rows 204-292)**:
   - Parse dates from description ("Walmart 1/12/25" → Jan 12, 2025)
   - Assign to periods based on parsed date
5. **Adi expenses (rows 0-194)**:
   - No dates available
   - Distribute proportionally across periods based on row order
   - Mark with `date_estimated = true`
6. **Skip rows 195-203**: These appear to be settlement calculations, not expenses

### Import UI Flow
1. Upload Excel file
2. Preview parsed data with period assignments
3. Review flagged items (unparseable dates, anomalies)
4. Confirm import
5. All historical periods marked as `status: closed, is_historical: true`

---

## Offline Support (PWA)

### Service Worker
- Cache app shell (HTML, CSS, JS)
- Cache API responses for current period
- Intercept requests when offline

### IndexedDB
- Store pending changes when offline
- Queue: `{ type: 'create_entry', data: {...}, timestamp }`

### Sync Strategy
- When online: Process queue in order
- Conflict resolution: Last-write-wins
- Show sync status indicator
- Option to review conflicts manually

### Offline Capabilities
- View current period data
- Add time entries (queued)
- Add expenses (queued)
- View recent history

### Requires Online
- Initial app load
- Full analytics
- Historical data
- Generate share links

---

## Read-Only Sharing

### Token Generation
```python
token = secrets.token_urlsafe(32)  # 43 characters
```

### Access Flow
1. Rafi generates link in Settings
2. Link format: `https://app.example.com/view/{token}`
3. Optional: Set 4-digit PIN
4. Share link with Adi
5. Adi opens link, enters PIN if required
6. Sees read-only dashboard

### Permissions
- View: Dashboard, current period, all history, analytics
- Cannot: Add, edit, delete anything
- Cannot: See settings, generate links

### Security
- Token stored hashed in database
- Optional expiration date
- Rafi can revoke anytime
- Regenerating creates new token (old one invalid)

---

## Docker Deployment

### docker-compose.yml
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_URL=sqlite:///./data/caregiver.db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:8000
```

### Backup Strategy
- Cron job runs daily at 2am
- Copies `caregiver.db` to `backups/caregiver-YYYY-MM-DD.db`
- Keeps last 30 days
- SQLite file can be copied while running (with WAL mode)

---

## Notifications

### Browser Notifications (opt-in)
- "Period ends in 2 days - you have 3 days with no entries"
- "New period started - copy schedule from last period?"
- "Unsettled balance of $484 from last period"

### Pattern-Based Suggestions
- Track when recurring expenses are typically added
- "You usually add FPL around the 25th - add now?"
- Learn from user corrections

### Settings
- Toggle each notification type
- Set quiet hours
- Disable all

---

## Settlement Calculation

### Formula
```
total_cost = sum(time_entries.total_pay) + sum(expenses.amount)
fair_share = total_cost / 2

adi_paid = sum(expenses where paid_by='Adi') + sum(caregiver_payments where payer='Adi')
rafi_paid = sum(expenses where paid_by='Rafi') + sum(caregiver_payments where payer='Rafi')

if adi_paid > fair_share:
    settlement = adi_paid - fair_share
    direction = 'rafi_owes_adi'
else:
    settlement = rafi_paid - fair_share
    direction = 'adi_owes_rafi'

final = settlement + carryover_from_previous
```

### Caregiver Payment Tracking
- Expenses with category "Caregiver Payment" track who paid which caregiver
- Enables optimization: "If Adi pays Julia, settlement reduces to $52"

---

## Success Criteria

1. **Data entry < 2 minutes per day** - Quick-add bar and templates make logging fast
2. **Settlement accuracy 100%** - Math is automated and verified
3. **Historical data preserved** - All 2 years imported and accessible
4. **Works on phone** - Responsive design, offline capable
5. **Adi can verify** - Read-only link shows full transparency
6. **Zero maintenance** - SQLite + Docker = nothing to manage

---

## Implementation Phases

### Phase 1: Core (MVP)
- Database models and migrations
- Basic CRUD APIs
- Dashboard, Time Entries, Expenses pages
- Settlement calculation
- Period management

### Phase 2: Import & History
- Excel import wizard
- Historical data migration
- Analytics page
- Export functionality

### Phase 3: Productivity
- Natural language parser
- Shift templates
- Recurring expenses
- Carryforward system

### Phase 4: Polish
- Read-only sharing
- Offline PWA
- Notifications
- Mobile optimization

---

## Appendix: Known Caregivers

| Name | Rate | Status |
|------|------|--------|
| Julia | $15/hr | Active |
| Diana | $15/hr | Active |
| Edwina | $15/hr | Active |
| Margaret | $15/hr | Active |
| Emma | $15/hr | Active |
| Joceylne | $15/hr | Active |
| Jemma | $16/hr | Active |
| Geraldine | $15/hr | Active |
| Layy | $15/hr | Active |

## Appendix: Expense Categories

- Rent
- Utilities
- Groceries
- Medical
- Caregiver Payment
- Insurance
- Supplies
- Other
