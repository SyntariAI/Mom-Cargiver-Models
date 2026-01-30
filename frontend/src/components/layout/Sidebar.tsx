import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/time-entries', icon: Clock, label: 'Time Entries' },
  { to: '/expenses', icon: DollarSign, label: 'Expenses' },
  { to: '/caregivers', icon: Users, label: 'Caregivers' },
  { to: '/periods', icon: Calendar, label: 'Pay Periods' },
  { to: '/import', icon: Upload, label: 'Import Data' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-xl font-semibold text-primary">Care Tracker</span>
      </div>
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
