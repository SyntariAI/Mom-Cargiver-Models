import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, parseISO } from 'date-fns';
import {
  Plus,
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  RotateCcw,
  GitCompare,
  Clock,
  DollarSign,
  Receipt,
  CheckCircle,
} from 'lucide-react';

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
import { Checkbox } from '@/components/ui/checkbox';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  usePayPeriods,
  useCreatePayPeriod,
  useClosePeriod,
  useReopenPeriod,
  useSettlement,
} from '@/hooks/use-api';
import { usePeriodComparison } from '@/hooks/use-analytics';
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
  onReopen: () => void;
  isClosing: boolean;
  isReopening: boolean;
  isSelected: boolean;
  onSelectionChange: (checked: boolean) => void;
}

function PeriodCard({
  period,
  isExpanded,
  onToggleExpand,
  onClose,
  onReopen,
  isClosing,
  isReopening,
  isSelected,
  onSelectionChange,
}: PeriodCardProps) {
  const { data: settlement, isLoading: settlementLoading } = useSettlement(period.id);
  const navigate = useNavigate();

  return (
    <Card className={isSelected ? 'ring-2 ring-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Selection Checkbox */}
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectionChange}
              aria-label={`Select period ${formatDateRange(period.start_date, period.end_date)}`}
            />
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={onToggleExpand}
            className="p-1 hover:bg-muted rounded-sm transition-colors mt-0.5"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Period Info */}
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDateRange(period.start_date, period.end_date)}
            </CardTitle>
            {period.notes && (
              <CardDescription className="mt-1">{period.notes}</CardDescription>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            {settlement?.settled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <CheckCircle className="h-3 w-3" />
                Settled
              </span>
            )}
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
        </div>
      </CardHeader>
      <CardContent className="pt-0 pl-12">
        {/* Summary Stats */}
        {settlementLoading ? (
          <div className="text-sm text-muted-foreground">Loading summary...</div>
        ) : settlement ? (
          <div className="space-y-3">
            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Hours</p>
                  <p className="font-medium">
                    {parseFloat(
                      (
                        parseFloat(settlement.total_caregiver_cost) /
                        (settlement.total_caregiver_cost === '0' ? 1 : 25)
                      ).toFixed(1)
                    ) || '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Caregiver Cost</p>
                  <p className="font-medium">{formatCurrency(settlement.total_caregiver_cost)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Expenses</p>
                  <p className="font-medium">{formatCurrency(settlement.total_expenses)}</p>
                </div>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/periods/${period.id}`)}
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </Button>
              {period.status === 'open' ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onClose}
                  disabled={isClosing}
                >
                  {isClosing ? 'Closing...' : 'Close Period'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReopen}
                  disabled={isReopening}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {isReopening ? 'Reopening...' : 'Reopen'}
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
            Are you sure you want to close this pay period? You can reopen it later if needed.
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

// Reopen Period Confirmation Dialog
interface ReopenPeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: PayPeriod | null;
  onConfirm: () => void;
  isReopening: boolean;
}

function ReopenPeriodDialog({
  open,
  onOpenChange,
  period,
  onConfirm,
  isReopening,
}: ReopenPeriodDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reopen Pay Period</DialogTitle>
          <DialogDescription>
            Are you sure you want to reopen this pay period? This will allow new entries to be added.
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
            disabled={isReopening}
          >
            {isReopening ? 'Reopening...' : 'Reopen Period'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Period Comparison Modal
interface ComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPeriodIds: number[];
}

function ComparisonModal({ open, onOpenChange, selectedPeriodIds }: ComparisonModalProps) {
  const { data: comparisonData, isLoading } = usePeriodComparison(
    open ? selectedPeriodIds : []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Period Comparison</DialogTitle>
          <DialogDescription>
            Side-by-side comparison of {selectedPeriodIds.length} selected pay periods
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading comparison data...</p>
          </div>
        ) : comparisonData ? (
          <div className="space-y-4">
            {/* Comparison Table */}
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-medium">Period</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Caregiver Cost</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.periods.map((period) => (
                    <TableRow key={period.period_id}>
                      <TableCell className="font-medium">
                        {formatDateRange(period.start_date, period.end_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(period.total_hours).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(period.total_caregiver_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(period.total_expenses)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(period.total_cost)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            period.status === 'open'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {period.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Averages Row */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell>Average</TableCell>
                    <TableCell className="text-right">
                      {parseFloat(comparisonData.averages.avg_hours).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(comparisonData.averages.avg_caregiver_cost)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(comparisonData.averages.avg_expenses)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(comparisonData.averages.avg_total_cost)}
                    </TableCell>
                    <TableCell>-</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Caregiver Breakdown */}
            {comparisonData.periods.some(p => p.caregiver_breakdown.length > 0) && (
              <div>
                <h4 className="font-medium mb-2">Caregiver Breakdown</h4>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Caregiver</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonData.periods.flatMap((period) =>
                        period.caregiver_breakdown.map((cg, idx) => (
                          <TableRow key={`${period.period_id}-${cg.caregiver_id}`}>
                            {idx === 0 && (
                              <TableCell
                                rowSpan={period.caregiver_breakdown.length}
                                className="font-medium align-top"
                              >
                                {formatDateRange(period.start_date, period.end_date)}
                              </TableCell>
                            )}
                            <TableCell>{cg.caregiver_name}</TableCell>
                            <TableCell className="text-right">
                              {parseFloat(cg.hours).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(cg.cost)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground text-center py-8">
            No comparison data available
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main PayPeriods Component
export function PayPeriods() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [periodToClose, setPeriodToClose] = useState<PayPeriod | null>(null);
  const [periodToReopen, setPeriodToReopen] = useState<PayPeriod | null>(null);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<number[]>([]);

  const { data: periods = [], isLoading, error } = usePayPeriods();
  const createPayPeriod = useCreatePayPeriod();
  const closePeriod = useClosePeriod();
  const reopenPeriod = useReopenPeriod();

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

  const handleOpenReopenDialog = (period: PayPeriod) => {
    setPeriodToReopen(period);
    setReopenDialogOpen(true);
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

  const handleConfirmReopen = async () => {
    if (periodToReopen) {
      try {
        await reopenPeriod.mutateAsync(periodToReopen.id);
        setReopenDialogOpen(false);
        setPeriodToReopen(null);
      } catch (err) {
        console.error('Failed to reopen pay period:', err);
      }
    }
  };

  const toggleExpand = (periodId: number) => {
    setExpandedPeriodId((prev) => (prev === periodId ? null : periodId));
  };

  const togglePeriodSelection = (periodId: number, checked: boolean) => {
    setSelectedPeriodIds((prev) =>
      checked ? [...prev, periodId] : prev.filter((id) => id !== periodId)
    );
  };

  const selectAllPeriods = () => {
    setSelectedPeriodIds(sortedPeriods.map((p) => p.id));
  };

  const clearSelection = () => {
    setSelectedPeriodIds([]);
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
        <div className="flex items-center gap-2">
          {/* Compare Button */}
          {selectedPeriodIds.length >= 2 && (
            <Button variant="outline" onClick={() => setComparisonModalOpen(true)}>
              <GitCompare className="mr-2 h-4 w-4" />
              Compare Selected ({selectedPeriodIds.length})
            </Button>
          )}
          <Button
            onClick={() => setCreateDialogOpen(true)}
            disabled={hasOpenPeriod}
            title={hasOpenPeriod ? 'Close the current open period before creating a new one' : undefined}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Period
          </Button>
        </div>
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

      {/* Selection Controls */}
      {sortedPeriods.length > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {selectedPeriodIds.length} selected
          </span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={selectAllPeriods}>
            Select all
          </Button>
          {selectedPeriodIds.length > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={clearSelection}>
              Clear selection
            </Button>
          )}
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
              onReopen={() => handleOpenReopenDialog(period)}
              isClosing={closePeriod.isPending && periodToClose?.id === period.id}
              isReopening={reopenPeriod.isPending && periodToReopen?.id === period.id}
              isSelected={selectedPeriodIds.includes(period.id)}
              onSelectionChange={(checked) => togglePeriodSelection(period.id, checked)}
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

      {/* Reopen Period Confirmation Dialog */}
      <ReopenPeriodDialog
        open={reopenDialogOpen}
        onOpenChange={setReopenDialogOpen}
        period={periodToReopen}
        onConfirm={handleConfirmReopen}
        isReopening={reopenPeriod.isPending}
      />

      {/* Period Comparison Modal */}
      <ComparisonModal
        open={comparisonModalOpen}
        onOpenChange={setComparisonModalOpen}
        selectedPeriodIds={selectedPeriodIds}
      />
    </div>
  );
}

export default PayPeriods;
