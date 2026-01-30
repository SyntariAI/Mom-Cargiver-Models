import { useState, useMemo, useCallback } from 'react';
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
import { EditableCell, type SelectOption } from '@/components/ui/editable-cell';
import { EditDialog, type FieldConfig } from '@/components/EditDialog';
import { useToast } from '@/hooks/use-toast';

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

// Edit Dialog Schema
const editExpenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.string().min(1, 'Amount is required'),
  date: z.string().min(1, 'Date is required'),
  paid_by: z.string().min(1, 'Please select who paid'),
  category: z.string().min(1, 'Please select a category'),
  is_recurring: z.boolean(),
  notes: z.string().optional(),
});

export function Expenses() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogExpense, setEditDialogExpense] = useState<Expense | null>(null);

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
  const { toast } = useToast();

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

  // Select options for inline editing
  const paidBySelectOptions: SelectOption[] = [
    { value: 'Adi', label: 'Adi' },
    { value: 'Rafi', label: 'Rafi' },
  ];

  const categorySelectOptions: SelectOption[] = EXPENSE_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));

  // Inline update handler
  const handleInlineUpdate = useCallback(async (
    expenseId: number,
    field: string,
    value: string
  ) => {
    try {
      const data: Partial<Expense> = { [field]: value };
      await updateExpense.mutateAsync({ id: expenseId, data });
      toast({
        title: 'Updated',
        description: 'Expense updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update expense.',
        variant: 'destructive',
      });
      throw error; // Re-throw to trigger error animation
    }
  }, [updateExpense, toast]);

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

  const handleEditDialog = (expense: Expense) => {
    setEditDialogExpense(expense);
    setEditDialogOpen(true);
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

    try {
      if (editingExpense) {
        await updateExpense.mutateAsync({
          id: editingExpense.id,
          data: expenseData,
        });
        toast({
          title: 'Updated',
          description: 'Expense updated successfully.',
        });
      } else {
        await createExpense.mutateAsync(expenseData);
        toast({
          title: 'Created',
          description: 'Expense created successfully.',
        });
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingExpense(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save expense.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await deleteExpense.mutateAsync(id);
        toast({
          title: 'Deleted',
          description: 'Expense deleted successfully.',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete expense.',
          variant: 'destructive',
        });
      }
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

  // Edit dialog fields config
  const editDialogFields: FieldConfig[] = useMemo(() => [
    {
      name: 'date',
      label: 'Date',
      type: 'date',
      required: true,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'text',
      required: true,
    },
    {
      name: 'amount',
      label: 'Amount ($)',
      type: 'number',
      step: '0.01',
      min: '0',
      required: true,
    },
    {
      name: 'paid_by',
      label: 'Paid By',
      type: 'select',
      options: paidBySelectOptions,
      required: true,
    },
    {
      name: 'category',
      label: 'Category',
      type: 'select',
      options: categorySelectOptions,
      required: true,
    },
    {
      name: 'is_recurring',
      label: 'Is Recurring',
      type: 'checkbox',
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
    },
  ], []);

  const handleEditDialogSubmit = async (values: z.infer<typeof editExpenseSchema>) => {
    if (!editDialogExpense) return;

    try {
      await updateExpense.mutateAsync({
        id: editDialogExpense.id,
        data: {
          description: values.description,
          amount: values.amount,
          date: values.date,
          paid_by: values.paid_by as 'Adi' | 'Rafi',
          category: values.category as ExpenseCategory,
          is_recurring: values.is_recurring,
          notes: values.notes || null,
        },
      });
      toast({
        title: 'Updated',
        description: 'Expense updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update expense.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Define columns for DataTable
  const columns: ColumnDef<Expense>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: createSortableHeader('Date'),
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <EditableCell
              value={expense.date}
              displayValue={formatDate(expense.date)}
              type="date"
              onSave={(value) => handleInlineUpdate(expense.id, 'date', value)}
            />
          );
        },
      },
      {
        accessorKey: 'description',
        header: createSortableHeader('Description'),
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <div className="flex items-center gap-2">
              <EditableCell
                value={expense.description}
                type="text"
                onSave={(value) => handleInlineUpdate(expense.id, 'description', value)}
              />
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
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <EditableCell
              value={expense.category}
              type="select"
              options={categorySelectOptions}
              onSave={(value) => handleInlineUpdate(expense.id, 'category', value)}
            />
          );
        },
      },
      {
        accessorKey: 'amount',
        header: createSortableHeader('Amount'),
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <div className="text-right font-medium">
              <EditableCell
                value={expense.amount}
                displayValue={formatCurrency(expense.amount)}
                type="number"
                step="0.01"
                min="0"
                onSave={(value) => handleInlineUpdate(expense.id, 'amount', value)}
                inputClassName="text-right"
              />
            </div>
          );
        },
      },
      {
        accessorKey: 'paid_by',
        header: createSortableHeader('Paid By'),
        cell: ({ row }) => {
          const expense = row.original;
          return (
            <EditableCell
              value={expense.paid_by}
              type="select"
              options={paidBySelectOptions}
              onSave={(value) => handleInlineUpdate(expense.id, 'paid_by', value)}
            />
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEditDialog(row.original)}
              title="Edit all fields"
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
    [handleInlineUpdate, deleteExpense.isPending]
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

      {/* Full Edit Dialog */}
      {editDialogExpense && (
        <EditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          title="Edit Expense"
          fields={editDialogFields}
          schema={editExpenseSchema}
          defaultValues={{
            description: editDialogExpense.description,
            amount: editDialogExpense.amount,
            date: editDialogExpense.date,
            paid_by: editDialogExpense.paid_by,
            category: editDialogExpense.category,
            is_recurring: editDialogExpense.is_recurring,
            notes: editDialogExpense.notes || '',
          }}
          onSubmit={handleEditDialogSubmit}
          isLoading={updateExpense.isPending}
        />
      )}
    </div>
  );
}

export default Expenses;
