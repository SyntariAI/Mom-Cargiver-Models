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
  useMonthlyTrend,
  useCaregiverBreakdown,
  useExpenseCategories,
  useAllTimeSummary,
} from '@/hooks/use-analytics';
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
import { LineChart, PieChart, BarChart } from '@/components/charts';

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

function formatHours(hours: string | number): string {
  const num = typeof hours === 'string' ? parseFloat(hours) : hours;
  return `${num.toFixed(1)} hrs`;
}

// Trend indicator component
function TrendIndicator({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0) return null;

  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className={isPositive ? 'text-red-500' : 'text-green-500'}>
        {isPositive ? '+' : ''}{change.toFixed(1)}%
      </span>
      <span className="text-muted-foreground">vs {label}</span>
    </div>
  );
}

// Loading skeleton for charts
function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center bg-muted/10 rounded-lg animate-pulse"
      style={{ height }}
    >
      <p className="text-muted-foreground">Loading chart...</p>
    </div>
  );
}

export function Dashboard() {
  const { data: currentPeriod, isLoading: periodLoading, error: periodError } = useCurrentPeriod();
  const periodId = currentPeriod?.id;

  const { data: settlement, isLoading: settlementLoading } = useSettlement(periodId ?? 0);
  const { data: timeEntries, isLoading: entriesLoading } = useTimeEntries(periodId);
  const { data: allExpenses, isLoading: expensesLoading } = useExpenses(periodId);
  const { data: caregivers } = useCaregivers();
  const markSettled = useMarkSettled();

  // Analytics hooks
  const { data: monthlyTrend, isLoading: trendLoading } = useMonthlyTrend(12);
  const { data: caregiverBreakdown, isLoading: breakdownLoading } = useCaregiverBreakdown(periodId);
  const { data: expenseCategories, isLoading: categoriesLoading } = useExpenseCategories(periodId);
  const { data: allTimeSummary, isLoading: summaryLoading } = useAllTimeSummary();

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

  // Prepare chart data - API returns arrays directly, not { data: [...] }
  const monthlyTrendData = (Array.isArray(monthlyTrend) ? monthlyTrend : []).map((item) => ({
    month: item.month,
    caregiver_cost: parseFloat(item.total_caregiver_cost),
    expenses: parseFloat(item.total_expenses),
  }));

  const caregiverPieData = (Array.isArray(caregiverBreakdown) ? caregiverBreakdown : []).map((item) => ({
    name: item.caregiver_name,
    value: parseFloat(item.total_hours),
  }));

  const expenseCategoryData = (Array.isArray(expenseCategories) ? expenseCategories : []).map((item) => ({
    category: item.category,
    amount: parseFloat(item.total_amount),
  }));

  const contributionsData = [
    { name: 'Adi', amount: adiExpenses },
    { name: 'Rafi', amount: rafiExpenses },
  ];

  // Calculate trend comparison (current period vs previous month)
  const trendArray = Array.isArray(monthlyTrend) ? monthlyTrend : [];
  const previousMonthData = trendArray.length >= 2 ? trendArray[trendArray.length - 2] : null;
  const previousCaregiverCost = previousMonthData ? parseFloat(previousMonthData.total_caregiver_cost) : 0;

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

      {/* Quick Stats Cards - Current Period */}
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
              {!entriesLoading && previousCaregiverCost > 0 && (
                <TrendIndicator
                  current={totalCaregiverCost}
                  previous={previousCaregiverCost}
                  label="last period"
                />
              )}
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

      {/* All-Time Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>All-Time Summary</CardTitle>
          <CardDescription>Lifetime statistics</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : allTimeSummary ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{formatHours(allTimeSummary.total_hours)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Caregiver Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(allTimeSummary.total_caregiver_cost)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold">{formatCurrency(allTimeSummary.total_expenses)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Pay Periods</p>
                <p className="text-2xl font-bold">{allTimeSummary.period_count}</p>
                <p className="text-xs text-muted-foreground">
                  Avg {formatCurrency(allTimeSummary.avg_caregiver_cost_per_period)}/period
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No data available</p>
          )}
        </CardContent>
      </Card>

      {/* Charts Section - 2 columns on desktop, 1 on mobile */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Spending Trend - Line Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
            <CardDescription>Caregiver costs and other expenses over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <ChartSkeleton height={350} />
            ) : monthlyTrendData.length > 0 ? (
              <LineChart
                data={monthlyTrendData}
                xAxisDataKey="month"
                height={350}
                lines={[
                  { dataKey: 'caregiver_cost', name: 'Caregiver Costs', color: 'hsl(var(--chart-1))' },
                  { dataKey: 'expenses', name: 'Other Expenses', color: 'hsl(var(--chart-2))' },
                ]}
                formatTooltip={(value) => formatCurrency(value)}
                formatYAxis={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caregiver Hours Breakdown - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Caregiver Hours Breakdown</CardTitle>
            <CardDescription>
              Hours distribution {currentPeriod ? 'for current period' : 'all-time'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <ChartSkeleton height={300} />
            ) : caregiverPieData.length > 0 ? (
              <PieChart
                data={caregiverPieData}
                height={300}
                innerRadius={40}
                outerRadius={100}
                formatTooltip={(value) => `${value.toFixed(1)} hours`}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No caregiver data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Categories - Horizontal Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Categories</CardTitle>
            <CardDescription>
              Spending by category {currentPeriod ? 'for current period' : 'all-time'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <ChartSkeleton height={300} />
            ) : expenseCategoryData.length > 0 ? (
              <BarChart
                data={expenseCategoryData}
                xAxisDataKey="category"
                layout="vertical"
                height={300}
                bars={[
                  { dataKey: 'amount', name: 'Amount', color: 'hsl(var(--chart-3))' },
                ]}
                showLegend={false}
                formatTooltip={(value) => formatCurrency(value)}
                formatYAxis={(value) => `$${value.toLocaleString()}`}
              />
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adi vs Rafi Contributions - Stacked Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Adi vs Rafi Contributions</CardTitle>
            <CardDescription>Total expenses paid by each person this period</CardDescription>
          </CardHeader>
          <CardContent>
            {expensesLoading ? (
              <ChartSkeleton height={200} />
            ) : (
              <BarChart
                data={contributionsData}
                xAxisDataKey="name"
                height={200}
                bars={[
                  { dataKey: 'amount', name: 'Amount Paid', color: 'hsl(var(--chart-4))' },
                ]}
                showLegend={false}
                formatTooltip={(value) => formatCurrency(value)}
                formatYAxis={(value) => `$${value.toLocaleString()}`}
              />
            )}
            {!expensesLoading && (
              <div className="mt-4 flex justify-between text-sm">
                <div>
                  <span className="text-muted-foreground">Adi: </span>
                  <span className="font-medium">{formatCurrency(adiExpenses)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rafi: </span>
                  <span className="font-medium">{formatCurrency(rafiExpenses)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-medium">{formatCurrency(adiExpenses + rafiExpenses)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caregiver Cost Distribution - Additional stacked bar showing cost breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Caregiver Cost Distribution</CardTitle>
            <CardDescription>
              Payment breakdown by caregiver {currentPeriod ? 'for current period' : 'all-time'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {breakdownLoading ? (
              <ChartSkeleton height={200} />
            ) : caregiverPieData.length > 0 ? (
              <BarChart
                data={(Array.isArray(caregiverBreakdown) ? caregiverBreakdown : []).map((item) => ({
                  name: item.caregiver_name,
                  cost: parseFloat(item.total_cost),
                }))}
                xAxisDataKey="name"
                height={200}
                bars={[
                  { dataKey: 'cost', name: 'Total Pay', color: 'hsl(var(--chart-5))' },
                ]}
                showLegend={false}
                formatTooltip={(value) => formatCurrency(value)}
                formatYAxis={(value) => `$${value.toLocaleString()}`}
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No caregiver cost data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
