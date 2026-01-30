import { Link } from 'react-router-dom';
import {
  useCurrentPeriod,
  useSettlement,
  useTimeEntries,
  useExpenses,
  useMarkSettled,
  useCaregivers,
} from '@/hooks/use-api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function Dashboard() {
  const { data: currentPeriod, isLoading: periodLoading, error: periodError } = useCurrentPeriod();
  const periodId = currentPeriod?.id;

  const { data: settlement, isLoading: settlementLoading } = useSettlement(periodId ?? 0);
  const { data: timeEntries, isLoading: entriesLoading } = useTimeEntries(periodId);
  const { data: allExpenses, isLoading: expensesLoading } = useExpenses(periodId);
  const { data: caregivers } = useCaregivers();
  const markSettled = useMarkSettled();

  // Create caregiver lookup map
  const caregiverMap = new Map(caregivers?.map((c) => [c.id, c.name]) ?? []);

  // Calculate stats from time entries
  const totalHours = timeEntries?.reduce((sum, entry) => sum + parseFloat(entry.hours), 0) ?? 0;
  const totalCaregiverCost = timeEntries?.reduce((sum, entry) => sum + parseFloat(entry.total_pay), 0) ?? 0;

  // Calculate expense totals by payer
  const adiExpenses = allExpenses?.filter((e) => e.paid_by === 'Adi').reduce((sum, e) => sum + parseFloat(e.amount), 0) ?? 0;
  const rafiExpenses = allExpenses?.filter((e) => e.paid_by === 'Rafi').reduce((sum, e) => sum + parseFloat(e.amount), 0) ?? 0;

  // Get recent entries (last 5)
  const recentTimeEntries = timeEntries?.slice(-5).reverse() ?? [];
  const recentExpenses = allExpenses?.slice(-5).reverse() ?? [];

  const handleMarkSettled = () => {
    if (periodId) {
      markSettled.mutate({ periodId });
    }
  };

  // Loading state
  if (periodLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Error state
  if (periodError) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Current Period Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Pay Period</CardTitle>
          <CardDescription>
            {currentPeriod
              ? `${formatDate(currentPeriod.start_date)} - ${formatDate(currentPeriod.end_date)}`
              : 'No open pay period'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!currentPeriod && (
            <Link to="/periods">
              <Button>Create Pay Period</Button>
            </Link>
          )}
          {currentPeriod && (
            <p className="text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">{currentPeriod.status}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Settlement Status Widget */}
      {currentPeriod && (
        <Card>
          <CardHeader>
            <CardTitle>Settlement Status</CardTitle>
            <CardDescription>Who owes whom for this period</CardDescription>
          </CardHeader>
          <CardContent>
            {settlementLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : settlement ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Expenses</span>
                  <span className="font-medium">{formatCurrency(settlement.total_expenses)}</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-lg font-semibold">
                    {settlement.settlement_direction === 'even'
                      ? 'Even'
                      : settlement.settlement_direction === 'adi_owes_rafi'
                      ? `Adi owes Rafi ${formatCurrency(settlement.final_amount)}`
                      : `Rafi owes Adi ${formatCurrency(settlement.final_amount)}`}
                  </p>
                </div>
                {!settlement.settled && (
                  <Button
                    onClick={handleMarkSettled}
                    disabled={markSettled.isPending}
                  >
                    {markSettled.isPending ? 'Marking...' : 'Mark as Settled'}
                  </Button>
                )}
                {settlement.settled && (
                  <p className="text-sm text-green-600 font-medium">
                    Settled on {settlement.settled_at ? formatDate(settlement.settled_at) : 'N/A'}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No settlement data available</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Cards */}
      {currentPeriod && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Caregiver Hours</CardDescription>
              <CardTitle className="text-2xl">
                {entriesLoading ? 'Loading...' : `${totalHours.toFixed(1)} hrs`}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Caregiver Cost</CardDescription>
              <CardTitle className="text-2xl">
                {entriesLoading ? 'Loading...' : formatCurrency(totalCaregiverCost)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Adi's Expenses</CardDescription>
              <CardTitle className="text-2xl">
                {expensesLoading ? 'Loading...' : formatCurrency(adiExpenses)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rafi's Expenses</CardDescription>
              <CardTitle className="text-2xl">
                {expensesLoading ? 'Loading...' : formatCurrency(rafiExpenses)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      {currentPeriod && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Time Entries</CardTitle>
              <CardDescription>Last 5 time entries this period</CardDescription>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : recentTimeEntries.length === 0 ? (
                <p className="text-muted-foreground">No time entries yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Caregiver</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTimeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          {entry.caregiver_name || caregiverMap.get(entry.caregiver_id) || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right">{parseFloat(entry.hours).toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Expenses */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Expenses</CardTitle>
              <CardDescription>Last 5 expenses this period</CardDescription>
            </CardHeader>
            <CardContent>
              {expensesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : recentExpenses.length === 0 ? (
                <p className="text-muted-foreground">No expenses yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{expense.description}</TableCell>
                        <TableCell>{expense.paid_by}</TableCell>
                        <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
