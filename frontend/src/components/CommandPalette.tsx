import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { format } from 'date-fns';
import { Clock, DollarSign, User, Search, Loader2 } from 'lucide-react';

import { search } from '@/lib/api';
import type { TimeEntry, Expense, Caregiver } from '@/types';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTimeEntries([]);
      setExpenses([]);
      setCaregivers([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await search.query(searchQuery);
      setTimeEntries(results.time_entries.slice(0, 5));
      setExpenses(results.expenses.slice(0, 5));
      setCaregivers(results.caregivers.slice(0, 5));
    } catch (error) {
      console.error('Search failed:', error);
      setTimeEntries([]);
      setExpenses([]);
      setCaregivers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle query changes with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setQuery('');
      setTimeEntries([]);
      setExpenses([]);
      setCaregivers([]);
    }
  }, [open]);

  const handleSelect = (type: string, item: TimeEntry | Expense | Caregiver) => {
    onOpenChange(false);

    switch (type) {
      case 'time_entry':
        // Navigate to time entries page with the period
        navigate(`/time-entries?period=${(item as TimeEntry).pay_period_id}`);
        break;
      case 'expense':
        // Navigate to expenses page with the period
        navigate(`/expenses?period=${(item as Expense).pay_period_id}`);
        break;
      case 'caregiver':
        // Navigate to caregivers page
        navigate('/caregivers');
        break;
    }
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const hasResults = timeEntries.length > 0 || expenses.length > 0 || caregivers.length > 0;
  const hasQuery = query.trim().length > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Command palette */}
      <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2">
        <Command
          className={cn(
            'rounded-lg border bg-background shadow-2xl',
            'dark:bg-slate-900 dark:border-slate-700'
          )}
          shouldFilter={false}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search time entries, expenses, caregivers..."
              className={cn(
                'flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none',
                'placeholder:text-muted-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin opacity-50" />
            )}
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {/* Loading state */}
            {isLoading && hasQuery && (
              <Command.Loading>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              </Command.Loading>
            )}

            {/* No results */}
            {!isLoading && hasQuery && !hasResults && (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>
            )}

            {/* Placeholder when no query */}
            {!hasQuery && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Start typing to search...
              </div>
            )}

            {/* Time Entries */}
            {timeEntries.length > 0 && (
              <Command.Group heading="Time Entries">
                {timeEntries.map((entry) => (
                  <Command.Item
                    key={`time-${entry.id}`}
                    value={`time-${entry.id}`}
                    onSelect={() => handleSelect('time_entry', entry)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                      'hover:bg-accent hover:text-accent-foreground',
                      'aria-selected:bg-accent aria-selected:text-accent-foreground'
                    )}
                  >
                    <Clock className="h-4 w-4 text-blue-500" />
                    <div className="flex flex-1 items-center justify-between">
                      <div>
                        <span className="font-medium">{formatDate(entry.date)}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span>{entry.caregiver_name || 'Unknown'}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {entry.hours} hrs
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Expenses */}
            {expenses.length > 0 && (
              <Command.Group heading="Expenses">
                {expenses.map((expense) => (
                  <Command.Item
                    key={`expense-${expense.id}`}
                    value={`expense-${expense.id}`}
                    onSelect={() => handleSelect('expense', expense)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                      'hover:bg-accent hover:text-accent-foreground',
                      'aria-selected:bg-accent aria-selected:text-accent-foreground'
                    )}
                  >
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <div className="flex flex-1 items-center justify-between">
                      <div>
                        <span className="font-medium">{formatDate(expense.date)}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span>{expense.description}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{expense.paid_by}</span>
                        <span>{formatCurrency(expense.amount)}</span>
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Caregivers */}
            {caregivers.length > 0 && (
              <Command.Group heading="Caregivers">
                {caregivers.map((caregiver) => (
                  <Command.Item
                    key={`caregiver-${caregiver.id}`}
                    value={`caregiver-${caregiver.id}`}
                    onSelect={() => handleSelect('caregiver', caregiver)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2',
                      'hover:bg-accent hover:text-accent-foreground',
                      'aria-selected:bg-accent aria-selected:text-accent-foreground'
                    )}
                  >
                    <User className="h-4 w-4 text-purple-500" />
                    <div className="flex flex-1 items-center justify-between">
                      <span className="font-medium">{caregiver.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(caregiver.default_hourly_rate)}/hr
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">esc</kbd>
                {' '}to close
              </span>
            </div>
            <div>
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">enter</kbd>
                {' '}to select
              </span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}

export default CommandPalette;
