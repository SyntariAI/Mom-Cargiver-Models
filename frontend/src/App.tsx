import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'

// Placeholder page components
function Dashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <p className="mt-2 text-muted-foreground">Welcome to the Caregiver Tracker</p>
    </div>
  )
}

function TimeEntries() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Time Entries</h2>
      <p className="mt-2 text-muted-foreground">Track caregiver hours</p>
    </div>
  )
}

function Expenses() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Expenses</h2>
      <p className="mt-2 text-muted-foreground">Track caregiver expenses</p>
    </div>
  )
}

function Caregivers() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Caregivers</h2>
      <p className="mt-2 text-muted-foreground">Manage caregivers</p>
    </div>
  )
}

function PayPeriods() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Pay Periods</h2>
      <p className="mt-2 text-muted-foreground">Manage pay periods and settlements</p>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/time-entries" element={<TimeEntries />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/caregivers" element={<Caregivers />} />
        <Route path="/periods" element={<PayPeriods />} />
      </Route>
    </Routes>
  )
}

export default App
