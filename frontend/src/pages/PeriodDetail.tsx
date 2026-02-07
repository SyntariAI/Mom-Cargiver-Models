import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Receipt,
  CheckCircle,
  XCircle,
  Pencil,
} from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, createSortableHeader } from '@/components/ui/data-table';

import {
  usePayPeriod,
  useSettlement,
  useTimeEntries,
  useExpenses,
  useClosePeriod,
  useReopenPeriod,
  useMarkSettled,
  useUnsettle,
} from '@/hooks/use-api';
import type { TimeEntry, Expense } from '@/types';
import {
  decimalToHoursMinutes,
  formatTimeTo12Hour,
  formatCurrency,
  formatDisplayDate,
} from '@/lib/time-utils';

// ============================================================================
// Helper Functions
// ============================================================================

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const startFormat = format(start, 'MMM d');
  const endFormat = format(end, 'MMM d, yyyy');
  return `${startFormat} - ${endFormat}`;
}

const formatDate = formatDisplayDate;
const formatTime = formatTimeTo12Hour;

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

function TabButton({ active, onClick, children, icon, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
      }`}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span
          className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
            active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

type TabType = 'time-entries' | 'expenses' | 'settlement';

export function PeriodDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const periodId = id ? parseInt(id, 10) : 0;

  const [activeTab, setActiveTab] = useState<TabType>('time-entries');
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [unsettleDialogOpen, setUnsettleDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');

  // Data hooks
  const { data: period, isLoading: periodLoading, error: periodError } = usePayPeriod(periodId);
  const { data: settlement, isLoading: settlementLoading } = useSettlement(periodId);
  const { data: timeEntries = [], isLoading: entriesLoading } = useTimeEntries(periodId);
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses(periodId);

  // Mutation hooks
  const closePeriod = useClosePeriod();
  const reopenPeriod = useReopenPeriod();
  const markSettled = useMarkSettled();
  const unsettle = useUnsettle();

  // Calculated values
  const totalHours = useMemo(() => {
    return timeEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
  }, [timeEntries]);

  const totalPay = useMemo(() => {
    return timeEntries.reduce((sum, entry) => sum + parseFloat(entry.total_pay), 0);
  }, [timeEntries]);

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
  }, [expenses]);

  // Handlers
  const handleClosePeriod = async () => {
    try {
      await closePeriod.mutateAsync(periodId);
      setCloseDialogOpen(false);
    } catch (error) {
      console.error('Failed to close period:', error);
    }
  };

  const handleReopenPeriod = async () => {
    try {
      await reopenPeriod.mutateAsync(periodId);
      setReopenDialogOpen(false);
    } catch (error) {
      console.error('Failed to reopen period:', error);
    }
  };

  const handleMarkSettled = async () => {
    try {
      await markSettled.mutateAsync({
        periodId,
        paymentMethod: paymentMethod || undefined,
      });
      setSettleDialogOpen(false);
      setPaymentMethod('');
    } catch (error) {
      console.error('Failed to mark as settled:', error);
    }
  };

  const handleUnsettle = async () => {
    try {
      await unsettle.mutateAsync(periodId);
      setUnsettleDialogOpen(false);
    } catch (error) {
      console.error('Failed to unsettle:', error);
    }
  };

  // Time entries columns
  const timeEntryColumns: ColumnDef<TimeEntry>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: createSortableHeader('Date'),
        cell: ({ row }) => formatDate(row.getValue('date')),
      },
      {
        accessorKey: 'caregiver_name',
        header: createSortableHeader('Caregiver'),
        cell: ({ row }) => row.getValue('caregiver_name') || '-',
      },
      {
        accessorKey: 'time_in',
        header: 'Time In',
        cell: ({ row }) => formatTime(row.getValue('time_in')),
      },
      {
        accessorKey: 'time_out',
        header: 'Time Out',
        cell: ({ row }) => formatTime(row.getValue('time_out')),
      },
      {
        accessorKey: 'hours',
        header: createSortableHeader('Hours'),
        cell: ({ row }) => (
          <div className="text-right">{decimalToHoursMinutes(row.getValue('hours') as string)}</div>
        ),
      },
      {
        accessorKey: 'hourly_rate',
        header: createSortableHeader('Rate'),
        cell: ({ row }) => (
          <div className="text-right">{formatCurrency(row.getValue('hourly_rate'))}</div>
        ),
      },
      {
        accessorKey: 'total_pay',
        header: createSortableHeader('Total Pay'),
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {formatCurrency(row.getValue('total_pay'))}
          </div>
        ),
      },
    ],
    []
  );

  // Expenses columns
  const expenseColumns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: createSortableHeader('Date'),
        cell: ({ row }) => formatDate(row.getValue('date')),
      },
      {
        accessorKey: 'description',
        header: createSortableHeader('Description'),
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <div className="flex items-center gap-2">
              {expense.description}
              {expense.is_recurring && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                  Recurring
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'category',
        header: createSortableHeader('Category'),
      },
      {
        accessorKey: 'amount',
        header: createSortableHeader('Amount'),
        cell: ({ row }) => (
          <div className="text-right font-medium">
            {formatCurrency(row.getValue('amount'))}
          </div>
        ),
      },
      {
        accessorKey: 'paid_by',
        header: createSortableHeader('Paid By'),
      },
    ],
    []
  );

  // Time entries footer
  const timeEntriesFooter = (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Total ({timeEntries.length} entries)</span>
      <div className="flex items-center gap-8">
        <div>
          <span className="text-muted-foreground">Hours:</span>{' '}
          <span className="font-medium">{decimalToHoursMinutes(totalHours)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Pay:</span>{' '}
          <span className="font-medium">{formatCurrency(totalPay)}</span>
        </div>
      </div>
    </div>
  );

  // Expenses footer
  const expensesFooter = (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Total ({expenses.length} expenses)</span>
      <div>
        <span className="text-muted-foreground">Total:</span>{' '}
        <span className="font-medium">{formatCurrency(totalExpenses)}</span>
      </div>
    </div>
  );

  // Loading state
  if (periodLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading period details...</p>
      </div>
    );
  }

  // Error state
  if (periodError || !period) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-destructive">Period not found</p>
        <Button variant="outline" onClick={() => navigate('/periods')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Pay Periods
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/periods')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-muted-foreground" />
            {formatDateRange(period.start_date, period.end_date)}
          </h1>
          {period.notes && (
            <p className="text-muted-foreground mt-1">{period.notes}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            period.status === 'open'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {period.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{decimalToHoursMinutes(totalHours)}</div>
            <p className="text-xs text-muted-foreground">{timeEntries.length} entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Caregiver Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPay)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">{expenses.length} expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {settlement?.settled ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-yellow-600" />
              )}
              Settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {settlementLoading ? (
              <div className="text-muted-foreground">Loading...</div>
            ) : settlement ? (
              <>
                <div className="text-2xl font-bold">
                  {settlement.settlement_direction === 'even'
                    ? 'Even'
                    : formatCurrency(settlement.final_amount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settlement.settlement_direction === 'even'
                    ? 'No payment needed'
                    : settlement.settlement_direction === 'adi_owes_rafi'
                    ? 'Adi owes Rafi'
                    : 'Rafi owes Adi'}
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">No settlement data</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {period.status === 'open' ? (
          <Button onClick={() => setCloseDialogOpen(true)} disabled={closePeriod.isPending}>
            {closePeriod.isPending ? 'Closing...' : 'Close Period'}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setReopenDialogOpen(true)}
            disabled={reopenPeriod.isPending}
          >
            {reopenPeriod.isPending ? 'Reopening...' : 'Reopen Period'}
          </Button>
        )}

        {settlement && !settlement.settled ? (
          <Button
            variant="default"
            onClick={() => setSettleDialogOpen(true)}
            disabled={markSettled.isPending}
          >
            {markSettled.isPending ? 'Marking...' : 'Mark Settled'}
          </Button>
        ) : settlement?.settled ? (
          <Button
            variant="outline"
            onClick={() => setUnsettleDialogOpen(true)}
            disabled={unsettle.isPending}
          >
            {unsettle.isPending ? 'Unsettling...' : 'Unsettle'}
          </Button>
        ) : null}

        <Link to={`/time-entries?period=${periodId}`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Time Entries
          </Button>
        </Link>

        <Link to={`/expenses?period=${periodId}`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Expenses
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <TabButton
            active={activeTab === 'time-entries'}
            onClick={() => setActiveTab('time-entries')}
            icon={<Clock className="h-4 w-4" />}
            count={timeEntries.length}
          >
            Time Entries
          </TabButton>
          <TabButton
            active={activeTab === 'expenses'}
            onClick={() => setActiveTab('expenses')}
            icon={<Receipt className="h-4 w-4" />}
            count={expenses.length}
          >
            Expenses
          </TabButton>
          <TabButton
            active={activeTab === 'settlement'}
            onClick={() => setActiveTab('settlement')}
            icon={<DollarSign className="h-4 w-4" />}
          >
            Settlement
          </TabButton>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'time-entries' && (
        <Card>
          <CardHeader>
            <CardTitle>Time Entries</CardTitle>
            <CardDescription>
              All time entries recorded for this pay period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={timeEntryColumns}
              data={timeEntries}
              isLoading={entriesLoading}
              emptyMessage="No time entries for this period."
              footerContent={timeEntries.length > 0 ? timeEntriesFooter : undefined}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'expenses' && (
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>
              All expenses recorded for this pay period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={expenseColumns}
              data={expenses}
              isLoading={expensesLoading}
              emptyMessage="No expenses for this period."
              footerContent={expenses.length > 0 ? expensesFooter : undefined}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'settlement' && (
        <Card>
          <CardHeader>
            <CardTitle>Settlement Details</CardTitle>
            <CardDescription>
              Financial breakdown and settlement status for this pay period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {settlementLoading ? (
              <div className="text-muted-foreground">Loading settlement data...</div>
            ) : settlement ? (
              <div className="space-y-6">
                {/* Settlement Status */}
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      settlement.settled ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">
                      {settlement.settled ? 'Settled' : 'Not Yet Settled'}
                    </p>
                    {settlement.settled && settlement.settled_at && (
                      <p className="text-sm text-muted-foreground">
                        Settled on {format(parseISO(settlement.settled_at), 'MMM d, yyyy')}
                        {settlement.payment_method && ` via ${settlement.payment_method}`}
                      </p>
                    )}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Costs</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Caregiver Cost</span>
                        <span className="font-medium">
                          {formatCurrency(settlement.total_caregiver_cost)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Expenses</span>
                        <span className="font-medium">
                          {formatCurrency(settlement.total_expenses)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground font-medium">Total Cost</span>
                        <span className="font-bold">
                          {formatCurrency(
                            parseFloat(settlement.total_caregiver_cost) +
                              parseFloat(settlement.total_expenses)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Payments Made</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Adi Paid</span>
                        <span className="font-medium">{formatCurrency(settlement.adi_paid)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Rafi Paid</span>
                        <span className="font-medium">{formatCurrency(settlement.rafi_paid)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settlement Amount */}
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">Settlement</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Settlement Amount</span>
                      <span className="font-medium">
                        {formatCurrency(settlement.settlement_amount)}
                      </span>
                    </div>
                    {parseFloat(settlement.carryover_amount) !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Carryover from Previous</span>
                        <span className="font-medium">
                          {formatCurrency(settlement.carryover_amount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="font-medium">Final Amount</span>
                      <span className="font-bold text-lg">
                        {settlement.settlement_direction === 'even'
                          ? 'Even - No Payment Needed'
                          : settlement.settlement_direction === 'adi_owes_rafi'
                          ? `Adi owes Rafi ${formatCurrency(settlement.final_amount)}`
                          : `Rafi owes Adi ${formatCurrency(settlement.final_amount)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground">No settlement data available</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Close Period Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Pay Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this pay period? You can reopen it later if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Period:{' '}
              <span className="font-medium text-foreground">
                {formatDateRange(period.start_date, period.end_date)}
              </span>
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleClosePeriod} disabled={closePeriod.isPending}>
              {closePeriod.isPending ? 'Closing...' : 'Close Period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Period Dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Pay Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to reopen this pay period? This will allow new entries to be
              added.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Period:{' '}
              <span className="font-medium text-foreground">
                {formatDateRange(period.start_date, period.end_date)}
              </span>
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleReopenPeriod} disabled={reopenPeriod.isPending}>
              {reopenPeriod.isPending ? 'Reopening...' : 'Reopen Period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Settled Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Settled</DialogTitle>
            <DialogDescription>
              Confirm that the settlement for this period has been paid.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {settlement && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  {settlement.settlement_direction === 'even'
                    ? 'No payment needed - the period is even.'
                    : settlement.settlement_direction === 'adi_owes_rafi'
                    ? `Adi owes Rafi ${formatCurrency(settlement.final_amount)}`
                    : `Rafi owes Adi ${formatCurrency(settlement.final_amount)}`}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method (optional)</Label>
              <Input
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g., Venmo, Zelle, Cash"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleMarkSettled} disabled={markSettled.isPending}>
              {markSettled.isPending ? 'Marking...' : 'Mark as Settled'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsettle Dialog */}
      <Dialog open={unsettleDialogOpen} onOpenChange={setUnsettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsettle Period</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this period as unsettled? This will clear the
              settlement date and payment method.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleUnsettle}
              disabled={unsettle.isPending}
            >
              {unsettle.isPending ? 'Unsettling...' : 'Unsettle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PeriodDetail;
