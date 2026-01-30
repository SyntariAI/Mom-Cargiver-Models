import { format } from 'date-fns'

export function Header() {
  const today = new Date()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-xl font-semibold">Mom's Care Tracker</h1>
      <div className="text-sm text-muted-foreground">
        {format(today, 'EEEE, MMMM d, yyyy')}
      </div>
    </header>
  )
}
