import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout'
import { Dashboard } from '@/pages/Dashboard'
import { TimeEntries } from '@/pages/TimeEntries'
import { Expenses } from '@/pages/Expenses'
import { Caregivers } from '@/pages/Caregivers'
import { PayPeriods } from '@/pages/PayPeriods'

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
