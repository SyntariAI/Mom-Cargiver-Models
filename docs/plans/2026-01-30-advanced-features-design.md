# Advanced Features Design - Mom's Care Tracker

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the caregiver tracking app into a comprehensive analytics and management platform with charts, drill-downs, inline editing, advanced filtering, and period management.

**Architecture:** React frontend with Recharts for visualizations, enhanced API endpoints for aggregations, and improved UX patterns for data management.

**Tech Stack:** React 18, TypeScript, Recharts, TanStack Table (for advanced table features), React Query, Tailwind CSS, shadcn/ui

---

## Section 1: Analytics & Insights Dashboard

### Interactive Charts

| Chart | Type | Purpose | Drill-down Action |
|-------|------|---------|-------------------|
| Monthly Spending Trend | Line | Total costs over last 12 months | Click month → navigate to period |
| Caregiver Hours Breakdown | Pie | Hours distribution per caregiver | Click slice → filter to caregiver |
| Expense Categories | Bar | Spending by category | Click bar → show category expenses |
| Adi vs Rafi Contributions | Stacked Bar | Compare who paid what | Click → see breakdown |
| Cost per Day Heatmap | Calendar | Spending intensity visualization | Click day → show day's entries |

### Enhanced Metrics Cards

- Total spent all-time
- Average cost per period
- Most expensive period (with link)
- Most utilized caregiver
- Settlement balance trend (sparkline)
- Hours this period vs last period (% change)

### Drill-down Pattern

Every chart element is clickable:
1. Click triggers filter state update
2. Slide-out panel shows filtered data OR
3. Navigate to relevant page with filters pre-applied in URL params

---

## Section 2: Data Management & Editing

### Inline Editing

All table cells support click-to-edit:
- Single click → cell becomes editable input
- Enter key → save changes
- Escape key → cancel edit
- Auto-save with debounce (300ms)
- Visual feedback: green pulse on success, red shake on error

### Edit Dialogs

Full edit modal for complex changes:
- All fields in form layout
- Field validation with error messages
- Timestamps: "Created", "Last modified"
- Cancel and Save buttons

### Bulk Operations

Table row checkboxes enable:
- Select all / Deselect all
- Bulk delete (with count confirmation)
- Bulk move to different period
- Bulk change caregiver
- Bulk change paid_by

### Delete Safety

- Soft delete: items move to Trash
- 10-second undo toast after delete
- Trash view to recover or permanently delete
- 30-day auto-purge of trash

### Period State Management

| Action | Available When | Side Effects |
|--------|---------------|--------------|
| Reopen Period | Closed | Unsettles if settled |
| Close Period | Open | Calculates settlement |
| Mark Settled | Closed + Unsettled | Records settlement date |
| Unsettle | Settled | Clears settlement, keeps data |

---

## Section 3: Navigation & Filtering

### Global Search

- Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows)
- Searches across: Time entries, Expenses, Caregivers, Periods
- Results grouped by type
- Recent searches remembered
- Fuzzy matching support

### Table Features

| Feature | Implementation |
|---------|---------------|
| Column sorting | Click header to toggle asc/desc/none |
| Multi-column sort | Shift+click for secondary sort |
| Column resizing | Drag column borders |
| Column visibility | Dropdown to toggle columns |
| Pagination | 25/50/100 rows per page |
| Row count | "Showing 1-25 of 721 entries" |

### Filter Components

**Time Entries Filters:**
- Date range (presets: This week, Last 2 weeks, This month, Last month, Custom)
- Caregiver (multi-select dropdown)
- Hours range (min/max inputs)
- Pay period (dropdown)

**Expenses Filters:**
- Date range (same presets)
- Paid by (Adi / Rafi / All)
- Category (multi-select)
- Amount range (min/max)
- Pay period (dropdown)

**Pay Periods Filters:**
- Status (Open / Closed / All)
- Year (dropdown)
- Settlement status (Settled / Unsettled / All)

### Filter Presets

- Save current filter combination with custom name
- Quick-access buttons for saved presets
- Share filter via URL params

---

## Section 4: Period Management

### Period List View

Enhanced card display:
```
┌─────────────────────────────────────────────────────────┐
│ Jan 12 - Jan 25, 2025                        [CLOSED]  │
├─────────────────────────────────────────────────────────┤
│ 📊 142.5 hrs │ 💰 $2,137.50 │ 🧾 12 expenses           │
│ Settlement: Adi owes Rafi $234.50 ✓ Settled            │
├─────────────────────────────────────────────────────────┤
│ [View Details] [Reopen] [Compare]                      │
└─────────────────────────────────────────────────────────┘
```

### Period Detail Page

Route: `/periods/:id`

Contents:
- Period header with status badge
- Summary stats row
- Tabbed content: Time Entries | Expenses | Settlement
- Inline editing within tabs
- Action buttons: Close/Reopen, Settle/Unsettle

### Period Comparison

Select multiple periods → comparison table:
- Side-by-side metrics
- Percentage change calculations
- Visual indicators (green/red arrows)
- Export comparison as CSV

### All-Time Analytics

Aggregated view across all periods:
- Cumulative totals
- Year-over-year comparisons
- Running settlement balance
- Caregiver utilization rankings
- Expense category trends

---

## New Backend Endpoints Required

```
GET  /api/analytics/monthly-trend
GET  /api/analytics/caregiver-breakdown
GET  /api/analytics/expense-categories
GET  /api/analytics/all-time-summary
GET  /api/analytics/period-comparison?ids=1,2,3

POST /api/pay-periods/:id/reopen
POST /api/settlements/:id/unsettle

GET  /api/time-entries/bulk
POST /api/time-entries/bulk-delete
POST /api/time-entries/bulk-update

GET  /api/expenses/bulk
POST /api/expenses/bulk-delete
POST /api/expenses/bulk-update

GET  /api/search?q=query
```

---

## New Dependencies

**Frontend:**
- `recharts` - Charting library
- `@tanstack/react-table` - Advanced table features
- `date-fns` - Date manipulation
- `cmdk` - Command palette for search (Cmd+K)

---

## Implementation Order

1. **Backend Analytics Endpoints** - New aggregation queries
2. **Recharts Integration** - Install and create chart components
3. **Enhanced Dashboard** - New analytics dashboard with charts
4. **Table Upgrades** - TanStack Table integration with sorting/filtering
5. **Inline Editing** - Click-to-edit functionality
6. **Bulk Operations** - Multi-select and bulk actions
7. **Period Management** - Reopen/unsettle functionality
8. **Global Search** - Cmd+K search palette
9. **Filter System** - Filter bar components and presets
10. **Period Comparison** - Comparison view
11. **Polish & Deploy** - Testing, fixes, production deployment
