import { format } from 'date-fns'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onSearchClick?: () => void;
}

export function Header({ onSearchClick }: HeaderProps) {
  const today = new Date()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-xl font-semibold">Mom's Care Tracker</h1>
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onSearchClick}
          className="gap-2 text-muted-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">&#8984;</span>K
          </kbd>
        </Button>
        <div className="text-sm text-muted-foreground">
          {format(today, 'EEEE, MMMM d, yyyy')}
        </div>
      </div>
    </header>
  )
}
