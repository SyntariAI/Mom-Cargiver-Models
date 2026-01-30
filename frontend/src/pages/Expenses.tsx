import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable, createSortableHeader } from '@/components/ui/data-table';
import { DateRangePicker, type DateRangeValue } from '@/components/filters/DateRangePicker';
import { MultiSelect, type MultiSelectOption } from '@/components/filters/MultiSelect';

import {
  useExpenses,
  useExpenseSummary,
  usePayPeriods,
  useCreateExpense,
  useDeleteExpense,
  useUpdateExpense,
} from '@/hooks/use-api';
import type { Expense, ExpenseCategory } from '@/types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Rent',
  'Utilities',
  'Groceries',
  'Medical',
  'Caregiver Payment',
  'Insurance',
  'Supplies',
  'Other',
];

const expenseFormSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.string().min(1, 'Amount is required').refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    'Amount must be a positive number'
  ),
  date: z.string().min(1, 'Date is required'),
  paid_by: z.string().min(1, 'Please select who paid'),
  category: z.string().min(1, 'Please select a category'),
  is_recurring: z.boolean(),
  notes: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

// Helper functions
const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), 'MMM d, yyyy');
};

export function Expenses() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Filter states
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: undefined, to: undefined });
  const [selectedPaidBy, setSelectedPaidBy] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const { data: payPeriods, isLoading: periodsLoading } = usePayPeriods();
  const { data: expenses, isLoading: expensesLoading } = useExpenses(selectedPeriodId);
  const { data: summary } = useExpenseSummary(selectedPeriodId ?? 0);

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      paid_by: '',
      category: '',
      is_recurring: false,
      notes: '',
    },
  });

  // Filter options
  const paidByOptions: MultiSelectOption[] = [
    { value: 'Adi', label: 'Adi' },
    { value: 'Rafi', label: 'Rafi' },
  ];

  const categoryOptions: MultiSelectOption[] = EXPENSE_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));

  // Filter and sort expenses
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    let result = [...expenses];

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      result = result.filter((expense) => {
        const expenseDate = parseISO(expense.date);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(expenseDate, { start: dateRange.from, end: dateRange.to });
        }
        if (dateRange.from) {
          return expenseDate >= dateRange.from;
        }
        if (dateRange.to) {
          return expenseDate <= dateRange.to;
        }
        return true;
      });
    }

    // Filter by paid by
    if (selectedPaidBy.length > 0) {
      result = result.filter((expense) => selectedPaidBy.includes(expense.paid_by));
    }

    // Filter by category
    if (selectedCategories.length > 0) {
      result = result.filter((expense) => selectedCategories.includes(expense.category));
    }

    // Filter by amount range
    if (minAmount !== '') {
      const min = parseFloat(minAmount);
      result = result.filter((expense) => parseFloat(expense.amount) >= min);
    }
    if (maxAmount !== '') {
      const max = parseFloat(maxAmount);
      result = result.filter((expense) => parseFloat(expense.amount) <= max);
    }

    return result;
  }, [expenses, dateRange, selectedPaidBy, selectedCategories, minAmount, maxAmount]);

  // Calculate totals for filtered expenses
  const filteredTotals = useMemo(() => {
    return filteredExpenses.reduce(
      (acc, expense) => {
        const amount = parseFloat(expense.amount);
        return {
          total: acc.total + amount,
          adi: acc.adi + (expense.paid_by === 'Adi' ? amount : 0),
          rafi: acc.rafi + (expense.paid_by === 'Rafi' ? amount : 0),
        };
      },
      { total: 0, adi: 0, rafi: 0 }
    );
  }, [filteredExpenses]);

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      form.reset({
        description: expense.description,
        amount: expense.amount,
        date: expense.date,
        paid_by: expense.paid_by,
        category: expense.category,
        is_recurring: expense.is_recurring,
        notes: expense.notes ?? '',
      });
    } else {
      setEditingExpense(null);
      form.reset({
        description: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        paid_by: '',
        category: '',
        is_recurring: false,
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: ExpenseFormValues) => {
    const expenseData = {
      description: values.description,
      amount: values.amount,
      date: values.date,
      paid_by: values.paid_by as 'Adi' | 'Rafi',
      category: values.category as ExpenseCategory,
      is_recurring: values.is_recurring,
      notes: values.notes || null,
      pay_period_id: selectedPeriodId,
    };

    if (editingExpense) {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        data: expenseData,
      });
    } else {
      await createExpense.mutateAsync(expenseData);
    }

    setIsDialogOpen(false);
    form.reset();
    setEditingExpense(null);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      await deleteExpense.mutateAsync(id);
    }
  };

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedPaidBy([]);
    setSelectedCategories([]);
    setMinAmount('');
    setMaxAmount('');
  };

  const hasActiveFilters =
    dateRange.from !== undefined ||
    dateRange.to !== undefined ||
    selectedPaidBy.length > 0 ||
    selectedCategories.length > 0 ||
    minAmount !== '' ||
    maxAmount !== '';

  // Define columns for DataTable
  const columns: ColumnDef<Expense>[] = useMemo(
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
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenDialog(row.original)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(row.original.id)}
              disabled={deleteExpense.isPending}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [deleteExpense.isPending]
  );

  // Footer content for totals
  const footerContent = (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Total ({filteredExpenses.length} expenses)</span>
      <div className="flex items-center gap-8">
        <div>
          <span className="text-muted-foreground">Adi:</span>{' '}
          <span className="font-medium">{formatCurrency(filteredTotals.adi)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Rafi:</span>{' '}
          <span className="font-medium">{formatCurrency(filteredTotals.rafi)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Total:</span>{' '}
          <span className="font-medium">{formatCurrency(filteredTotals.total)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Expenses</h2>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <Select
            value={selectedPeriodId?.toString() ?? 'all'}
            onValueChange={(value) =>
              setSelectedPeriodId(value === 'all' ? undefined : parseInt(value))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {payPeriods?.map((period) => (
                <SelectItem key={period.id} value={period.id.toString()}>
                  {format(new Date(period.start_date), 'MMM d')} -{' '}
                  {format(new Date(period.end_date), 'MMM d, yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Expense Button */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? 'Edit Expense' : 'Add Expense'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Date */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Paid By */}
                  <FormField
                    control={form.control}
                    name="paid_by"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paid By</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select who paid" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Adi">Adi</SelectItem>
                            <SelectItem value="Rafi">Rafi</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Is Recurring */}
                  <FormField
                    control={form.control}
                    name="is_recurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Is Recurring</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl>
                          <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="Add any additional notes..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      disabled={createExpense.isPending || updateExpense.isPending}
                    >
                      {createExpense.isPending || updateExpense.isPending
                        ? 'Saving...'
                        : 'Save'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(filteredTotals.total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Adi Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.adi_total ?? '0')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rafi Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.rafi_total ?? '0')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {summary?.by_category &&
                Object.entries(summary.by_category).map(([category, amount]) => (
                  <div key={category} className="flex justify-between">
                    <span className="text-muted-foreground">{category}</span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
              {(!summary?.by_category ||
                Object.keys(summary.by_category).length === 0) && (
                <span className="text-muted-foreground">No expenses yet</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Date Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Date Range
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
            </div>

            {/* Paid By Multi-select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Paid By
              </label>
              <MultiSelect
                options={paidByOptions}
                value={selectedPaidBy}
                onChange={setSelectedPaidBy}
                placeholder="All"
                className="w-[140px]"
              />
            </div>

            {/* Category Multi-select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Category
              </label>
              <MultiSelect
                options={categoryOptions}
                value={selectedCategories}
                onChange={setSelectedCategories}
                placeholder="All categories"
              />
            </div>

            {/* Amount Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Amount Range
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-24"
                  min="0"
                  step="0.01"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-24"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expenses List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredExpenses}
            isLoading={periodsLoading || expensesLoading}
            emptyMessage="No expenses found. Add your first expense to get started."
            enableRowSelection={true}
            footerContent={filteredExpenses.length > 0 ? footerContent : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Expenses;
