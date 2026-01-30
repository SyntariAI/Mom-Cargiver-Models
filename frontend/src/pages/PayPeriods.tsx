import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, parseISO } from 'date-fns';
import { Plus, Calendar, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  usePayPeriods,
  useCreatePayPeriod,
  useClosePeriod,
  useSettlement,
} from '@/hooks/use-api';
import type { PayPeriod } from '@/types';

// Helper function to format currency
function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

// Helper function to format date range for display (Jan 13 - Jan 26, 2026)
function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const startFormat = format(start, 'MMM d');
  const endFormat = format(end, 'MMM d, yyyy');
  return `${startFormat} - ${endFormat}`;
}

// Calculate suggested next bi-weekly period dates
function getSuggestedNextPeriod(periods: PayPeriod[]): { startDate: string; endDate: string } {
  if (periods.length === 0) {
    // No previous periods, suggest starting from today
    const today = new Date();
    const startDate = format(today, 'yyyy-MM-dd');
    const endDate = format(addDays(today, 13), 'yyyy-MM-dd'); // 14 days total (bi-weekly)
    return { startDate, endDate };
  }

  // Find the most recent period by end date
  const sortedPeriods = [...periods].sort(
    (a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime()
  );
  const lastPeriod = sortedPeriods[0];
  const lastEndDate = parseISO(lastPeriod.end_date);

  // Next period starts the day after the last period ended
  const newStartDate = addDays(lastEndDate, 1);
  const newEndDate = addDays(newStartDate, 13); // 14 days total (bi-weekly)

  return {
    startDate: format(newStartDate, 'yyyy-MM-dd'),
    endDate: format(newEndDate, 'yyyy-MM-dd'),
  };
}

// Period Card Component with settlement data
interface PeriodCardProps {
  period: PayPeriod;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  isClosing: boolean;
}

function PeriodCard({ period, isExpanded, onToggleExpand, onClose, isClosing }: PeriodCardProps) {
  const { data: settlement, isLoading: settlementLoading } = useSettlement(period.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-muted rounded-sm transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDateRange(period.start_date, period.end_date)}
              </CardTitle>
              {period.notes && (
                <CardDescription className="mt-1">{period.notes}</CardDescription>
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              period.status === 'open'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {period.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary Stats */}
        {settlementLoading ? (
          <div className="text-sm text-muted-foreground">Loading summary...</div>
        ) : settlement ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Caregiver Cost</p>
                <p className="font-medium">{formatCurrency(settlement.total_caregiver_cost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Expenses</p>
                <p className="font-medium">{formatCurrency(settlement.total_expenses)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Settlement</p>
                <p className="font-medium">
                  {settlement.settlement_direction === 'even'
                    ? 'Even'
                    : settlement.settlement_direction === 'adi_owes_rafi'
                    ? `Adi owes ${formatCurrency(settlement.final_amount)}`
                    : `Rafi owes ${formatCurrency(settlement.final_amount)}`}
                </p>
              </div>
            </div>

            {/* Settlement Status */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  settlement.settled ? 'bg-green-500' : 'bg-yellow-500'
                }`}
              />
              <span className={settlement.settled ? 'text-green-700' : 'text-yellow-700'}>
                {settlement.settled
                  ? `Settled${settlement.settled_at ? ` on ${format(parseISO(settlement.settled_at), 'MMM d, yyyy')}` : ''}`
                  : 'Not yet settled'}
              </span>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <h4 className="font-medium text-sm">Settlement Breakdown</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Adi Paid</p>
                    <p className="font-medium">{formatCurrency(settlement.adi_paid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rafi Paid</p>
                    <p className="font-medium">{formatCurrency(settlement.rafi_paid)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Settlement Amount</p>
                    <p className="font-medium">{formatCurrency(settlement.settlement_amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Carryover</p>
                    <p className="font-medium">{formatCurrency(settlement.carryover_amount)}</p>
                  </div>
                </div>

                {settlement.payment_method && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{settlement.payment_method}</p>
                  </div>
                )}

                {/* Navigation Links */}
                <div className="flex gap-2 pt-2">
                  <Link
                    to={`/time-entries?period=${period.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Time Entries
                  </Link>
                  <Link
                    to={`/expenses?period=${period.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Expenses
                  </Link>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Link to={`/?period=${period.id}`}>
                <Button variant="outline" size="sm">
                  View Dashboard
                </Button>
              </Link>
              {period.status === 'open' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onClose}
                  disabled={isClosing}
                >
                  {isClosing ? 'Closing...' : 'Close Period'}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No settlement data available</div>
        )}
      </CardContent>
    </Card>
  );
}

// Create Period Dialog Component
interface CreatePeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedDates: { startDate: string; endDate: string };
  onCreate: (data: { start_date: string; end_date: string; notes?: string }) => void;
  isCreating: boolean;
}

function CreatePeriodDialog({
  open,
  onOpenChange,
  suggestedDates,
  onCreate,
  isCreating,
}: CreatePeriodDialogProps) {
  const [startDate, setStartDate] = useState(suggestedDates.startDate);
  const [endDate, setEndDate] = useState(suggestedDates.endDate);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Update local state when dialog opens with new suggested dates
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setStartDate(suggestedDates.startDate);
      setEndDate(suggestedDates.endDate);
      setNotes('');
      setError('');
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!startDate || !endDate) {
      setError('Both start and end dates are required');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError('End date must be after start date');
      return;
    }

    setError('');
    onCreate({
      start_date: startDate,
      end_date: endDate,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Pay Period</DialogTitle>
          <DialogDescription>
            Create a new pay period. Dates are suggested based on a bi-weekly schedule.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Add any notes about this period..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Period'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Close Period Confirmation Dialog
interface ClosePeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: PayPeriod | null;
  onConfirm: () => void;
  isClosing: boolean;
}

function ClosePeriodDialog({
  open,
  onOpenChange,
  period,
  onConfirm,
  isClosing,
}: ClosePeriodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Close Pay Period</DialogTitle>
          <DialogDescription>
            Are you sure you want to close this pay period? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {period && (
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Period: <span className="font-medium text-foreground">
                {formatDateRange(period.start_date, period.end_date)}
              </span>
            </p>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="default"
            onClick={onConfirm}
            disabled={isClosing}
          >
            {isClosing ? 'Closing...' : 'Close Period'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main PayPeriods Component
export function PayPeriods() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [periodToClose, setPeriodToClose] = useState<PayPeriod | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);

  const { data: periods = [], isLoading, error } = usePayPeriods();
  const createPayPeriod = useCreatePayPeriod();
  const closePeriod = useClosePeriod();

  // Sort periods by start date (most recent first)
  const sortedPeriods = useMemo(() => {
    return [...periods].sort(
      (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }, [periods]);

  // Check if there's an open period
  const hasOpenPeriod = useMemo(() => {
    return periods.some((p) => p.status === 'open');
  }, [periods]);

  // Calculate suggested next period dates
  const suggestedDates = useMemo(() => {
    return getSuggestedNextPeriod(periods);
  }, [periods]);

  const handleCreatePeriod = async (data: { start_date: string; end_date: string; notes?: string }) => {
    try {
      await createPayPeriod.mutateAsync(data);
      setCreateDialogOpen(false);
    } catch (err) {
      console.error('Failed to create pay period:', err);
    }
  };

  const handleOpenCloseDialog = (period: PayPeriod) => {
    setPeriodToClose(period);
    setCloseDialogOpen(true);
  };

  const handleConfirmClose = async () => {
    if (periodToClose) {
      try {
        await closePeriod.mutateAsync(periodToClose.id);
        setCloseDialogOpen(false);
        setPeriodToClose(null);
      } catch (err) {
        console.error('Failed to close pay period:', err);
      }
    }
  };

  const toggleExpand = (periodId: number) => {
    setExpandedPeriodId((prev) => (prev === periodId ? null : periodId));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading pay periods...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading pay periods</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pay Periods</h1>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          disabled={hasOpenPeriod}
          title={hasOpenPeriod ? 'Close the current open period before creating a new one' : undefined}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Period
        </Button>
      </div>

      {/* Info about open period restriction */}
      {hasOpenPeriod && (
        <div className="rounded-md bg-yellow-50 p-4 text-sm text-yellow-800">
          <p>
            <strong>Note:</strong> Only one pay period can be open at a time. Close the current
            open period before creating a new one.
          </p>
        </div>
      )}

      {/* Pay Periods List */}
      {sortedPeriods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Pay Periods</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-md">
              Get started by creating your first pay period. Pay periods help you track
              caregiver time and expenses.
            </p>
            <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Period
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPeriods.map((period) => (
            <PeriodCard
              key={period.id}
              period={period}
              isExpanded={expandedPeriodId === period.id}
              onToggleExpand={() => toggleExpand(period.id)}
              onClose={() => handleOpenCloseDialog(period)}
              isClosing={closePeriod.isPending && periodToClose?.id === period.id}
            />
          ))}
        </div>
      )}

      {/* Create Period Dialog */}
      <CreatePeriodDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        suggestedDates={suggestedDates}
        onCreate={handleCreatePeriod}
        isCreating={createPayPeriod.isPending}
      />

      {/* Close Period Confirmation Dialog */}
      <ClosePeriodDialog
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        period={periodToClose}
        onConfirm={handleConfirmClose}
        isClosing={closePeriod.isPending}
      />
    </div>
  );
}

export default PayPeriods;
