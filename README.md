# Mom's Caregiver Tracker

A full-stack web application for tracking caregiver hours and shared family expenses for Mom's care. Built to help Adi and Rafi manage caregiver payments and split expenses 50/50.

## Features

- **Caregiver Management**: Track multiple caregivers with customizable hourly rates
- **Time Entry Tracking**: Log caregiver shifts with time in/out and hours worked
- **Expense Tracking**: Record shared expenses with category classification
- **Settlement Calculation**: Automatically calculate who owes whom at the end of each pay period
- **Pay Period Management**: Bi-weekly pay periods with historical tracking
- **Excel Import**: Import historical data from existing spreadsheets
- **Responsive Dashboard**: View summaries, recent activity, and settlement status

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM with SQLite database
- **Pydantic** - Data validation and serialization
- **Pandas** - Excel file parsing

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **React Query** - Data fetching and caching
- **React Router** - Client-side routing

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Mom-Cargiver-Models.git
   cd Mom-Cargiver-Models
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Run the backend**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

4. **Set up the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   ```

5. **Run the frontend**
   ```bash
   npm run dev
   ```

6. **Access the app**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Docker Deployment

### Using Docker Compose

1. **Build and run**
   ```bash
   docker-compose up -d
   ```

2. **Access the app**
   - http://localhost (frontend)
   - http://localhost:8000 (backend API)

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop**
   ```bash
   docker-compose down
   ```

### Data Persistence

The SQLite database is stored in the `./data` directory and persists across container restarts.

### Backups

Run the backup script to create a timestamped backup:
```bash
./scripts/backup.sh
```

Backups are saved to the `./backups` directory.

## Importing Historical Data

1. Navigate to **Import Data** in the sidebar
2. Upload your Excel file (.xlsx)
3. Follow the wizard steps:
   - Review and import caregivers
   - Generate pay periods for the date range
   - Import time entries
   - Import expenses
4. Review the import summary

### Excel File Format

The import wizard expects an Excel file with these sheets:

**Caregivers Sheet**: Name, Rate columns
```
| Name     | Rate  |
|----------|-------|
| Julia    | 15.00 |
| Diana    | 15.00 |
```

**Time Entries Sheet**: Date, Name, Rate, Time In, Time Out, Hours, Payment
```
| Date       | Name  | Rate  | Time In | Time Out | Hours | Payment |
|------------|-------|-------|---------|----------|-------|---------|
| 2024-01-15 | Julia | 15.00 | 7:00 PM | 7:00 AM  | 12    | 180.00  |
```

**Expenses Sheet**: Two sections for Adi's and Rafi's expenses
- Adi's expenses: Description column
- Rafi's expenses: Description, Amount columns
- Dates can be embedded in descriptions (e.g., "Walmart 1/12/25")

## API Documentation

The API documentation is available at http://localhost:8000/docs when the backend is running.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/caregivers` | GET, POST | List/create caregivers |
| `/api/pay-periods` | GET, POST | List/create pay periods |
| `/api/pay-periods/current` | GET | Get current open period |
| `/api/time-entries` | GET, POST | List/create time entries |
| `/api/expenses` | GET, POST | List/create expenses |
| `/api/settlements/{period_id}` | GET | Get settlement for period |
| `/api/import/upload` | POST | Upload Excel for import |

## Project Structure

```
Mom-Cargiver-Models/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # API endpoints
│   │   ├── core/            # Config and database
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic
│   ├── tests/               # Backend tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # API client
│   │   ├── pages/           # Page components
│   │   └── types/           # TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── scripts/
    └── backup.sh
```

## Running Tests

### Backend Tests
```bash
cd backend
python -m pytest -v
```

### Frontend Build Check
```bash
cd frontend
npm run build
```

## Settlement Calculation

The app automatically calculates settlements based on:

1. **Total Expenses**: Sum of all expenses in the pay period
2. **Fair Share**: Total expenses / 2 (50/50 split)
3. **Settlement**: Difference between what each person paid and their fair share

Example:
- Total expenses: $1000
- Adi paid: $600
- Rafi paid: $400
- Fair share: $500 each
- Result: Rafi owes Adi $100

## License

MIT
