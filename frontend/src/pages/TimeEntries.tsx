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
  useTimeEntries,
  usePayPeriods,
  useCaregivers,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from '@/hooks/use-api';
import type { TimeEntry, Caregiver } from '@/types';

// Form validation schema
const timeEntryFormSchema = z.object({
  caregiver_id: z.string().min(1, 'Caregiver is required'),
  date: z.string().min(1, 'Date is required'),
  time_in: z.string().optional(),
  time_out: z.string().optional(),
  hours: z.string().min(1, 'Hours is required'),
  hourly_rate: z.string().min(1, 'Hourly rate is required'),
  notes: z.string().optional(),
});

type TimeEntryFormValues = z.infer<typeof timeEntryFormSchema>;

interface TimeEntryDialogProps {
  entry?: TimeEntry;
  caregivers: Caregiver[];
  periodId: number | undefined;
  onClose: () => void;
}

function TimeEntryDialog({ entry, caregivers, periodId, onClose }: TimeEntryDialogProps) {
  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();

  const activeCaregivers = caregivers.filter((c) => c.is_active);

  // Get default caregiver rate
  const getDefaultRate = (caregiverId: string) => {
    const caregiver = caregivers.find((c) => c.id === Number(caregiverId));
    return caregiver?.default_hourly_rate || '';
  };

  const form = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntryFormSchema),
    defaultValues: {
      caregiver_id: entry?.caregiver_id?.toString() || '',
      date: entry?.date || format(new Date(), 'yyyy-MM-dd'),
      time_in: entry?.time_in || '',
      time_out: entry?.time_out || '',
      hours: entry?.hours || '',
      hourly_rate: entry?.hourly_rate || '',
      notes: entry?.notes || '',
    },
  });

  const onSubmit = async (values: TimeEntryFormValues) => {
    const data = {
      pay_period_id: periodId,
      caregiver_id: Number(values.caregiver_id),
      date: values.date,
      time_in: values.time_in || null,
      time_out: values.time_out || null,
      hours: values.hours,
      hourly_rate: values.hourly_rate,
      notes: values.notes || null,
    };

    try {
      if (entry) {
        await updateTimeEntry.mutateAsync({ id: entry.id, data });
      } else {
        await createTimeEntry.mutateAsync(data);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save time entry:', error);
    }
  };

  const handleCaregiverChange = (value: string) => {
    form.setValue('caregiver_id', value);
    // Auto-fill hourly rate from caregiver's default rate
    const rate = getDefaultRate(value);
    if (rate && !form.getValues('hourly_rate')) {
      form.setValue('hourly_rate', rate);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="caregiver_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Caregiver</FormLabel>
              <Select
                onValueChange={handleCaregiverChange}
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a caregiver" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {activeCaregivers.map((caregiver) => (
                    <SelectItem key={caregiver.id} value={caregiver.id.toString()}>
                      {caregiver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="time_in"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time In (optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="time_out"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Out (optional)</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hours</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="8"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hourly_rate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hourly Rate ($)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="25.00"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Add any notes..."
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
            disabled={createTimeEntry.isPending || updateTimeEntry.isPending}
          >
            {createTimeEntry.isPending || updateTimeEntry.isPending
              ? 'Saving...'
              : entry
              ? 'Update'
              : 'Add Entry'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// Helper functions
const formatTime = (time: string | null) => {
  if (!time) return '-';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

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
const editTimeEntrySchema = z.object({
  caregiver_id: z.string().min(1, 'Caregiver is required'),
  date: z.string().min(1, 'Date is required'),
  time_in: z.string().optional(),
  time_out: z.string().optional(),
  hours: z.string().min(1, 'Hours is required'),
  hourly_rate: z.string().min(1, 'Hourly rate is required'),
  notes: z.string().optional(),
});

export function TimeEntries() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | undefined>();

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogEntry, setEditDialogEntry] = useState<TimeEntry | null>(null);

  // Filter states
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: undefined, to: undefined });
  const [selectedCaregivers, setSelectedCaregivers] = useState<string[]>([]);
  const [minHours, setMinHours] = useState<string>('');
  const [maxHours, setMaxHours] = useState<string>('');

  const { data: periods = [] } = usePayPeriods();
  const { data: caregivers = [] } = useCaregivers();
  const { data: entries = [], isLoading } = useTimeEntries(selectedPeriodId);
  const deleteTimeEntry = useDeleteTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const { toast } = useToast();

  // Caregiver options for multi-select and inline editing
  const caregiverOptions: MultiSelectOption[] = useMemo(() => {
    return caregivers.map((c) => ({
      value: c.id.toString(),
      label: c.name,
    }));
  }, [caregivers]);

  const activeCaregiverOptions: SelectOption[] = useMemo(() => {
    return caregivers
      .filter((c) => c.is_active)
      .map((c) => ({
        value: c.id.toString(),
        label: c.name,
      }));
  }, [caregivers]);

  // Helper to get caregiver name
  const getCaregiverName = useCallback((caregiverId: number) => {
    const caregiver = caregivers.find((c) => c.id === caregiverId);
    return caregiver?.name || '-';
  }, [caregivers]);

  // Inline update handler
  const handleInlineUpdate = useCallback(async (
    entryId: number,
    field: string,
    value: string
  ) => {
    try {
      const data: Partial<TimeEntry> = { [field]: field === 'caregiver_id' ? Number(value) : value };
      await updateTimeEntry.mutateAsync({ id: entryId, data });
      toast({
        title: 'Updated',
        description: 'Time entry updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update time entry.',
        variant: 'destructive',
      });
      throw error; // Re-throw to trigger error animation
    }
  }, [updateTimeEntry, toast]);

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      result = result.filter((entry) => {
        const entryDate = parseISO(entry.date);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(entryDate, { start: dateRange.from, end: dateRange.to });
        }
        if (dateRange.from) {
          return entryDate >= dateRange.from;
        }
        if (dateRange.to) {
          return entryDate <= dateRange.to;
        }
        return true;
      });
    }

    // Filter by caregiver
    if (selectedCaregivers.length > 0) {
      result = result.filter((entry) =>
        selectedCaregivers.includes(entry.caregiver_id.toString())
      );
    }

    // Filter by hours range
    if (minHours !== '') {
      const min = parseFloat(minHours);
      result = result.filter((entry) => parseFloat(entry.hours) >= min);
    }
    if (maxHours !== '') {
      const max = parseFloat(maxHours);
      result = result.filter((entry) => parseFloat(entry.hours) <= max);
    }

    return result;
  }, [entries, dateRange, selectedCaregivers, minHours, maxHours]);

  // Calculate totals for filtered entries
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => ({
        hours: acc.hours + parseFloat(entry.hours),
        pay: acc.pay + parseFloat(entry.total_pay),
      }),
      { hours: 0, pay: 0 }
    );
  }, [filteredEntries]);

  const handleEditDialog = (entry: TimeEntry) => {
    setEditDialogEntry(entry);
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (entry: TimeEntry) => {
    setDeletingEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deletingEntry) {
      try {
        await deleteTimeEntry.mutateAsync(deletingEntry.id);
        setDeleteDialogOpen(false);
        setDeletingEntry(undefined);
        toast({
          title: 'Deleted',
          description: 'Time entry deleted successfully.',
        });
      } catch (error) {
        console.error('Failed to delete time entry:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete time entry.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEntry(undefined);
  };

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    setSelectedCaregivers([]);
    setMinHours('');
    setMaxHours('');
  };

  const hasActiveFilters =
    dateRange.from !== undefined ||
    dateRange.to !== undefined ||
    selectedCaregivers.length > 0 ||
    minHours !== '' ||
    maxHours !== '';

  // Edit dialog fields config
  const editDialogFields: FieldConfig[] = useMemo(() => [
    {
      name: 'date',
      label: 'Date',
      type: 'date',
      required: true,
    },
    {
      name: 'caregiver_id',
      label: 'Caregiver',
      type: 'select',
      options: activeCaregiverOptions,
      required: true,
    },
    {
      name: 'time_in',
      label: 'Time In',
      type: 'time',
    },
    {
      name: 'time_out',
      label: 'Time Out',
      type: 'time',
    },
    {
      name: 'hours',
      label: 'Hours',
      type: 'number',
      step: '0.25',
      min: '0',
      required: true,
    },
    {
      name: 'hourly_rate',
      label: 'Hourly Rate ($)',
      type: 'number',
      step: '0.01',
      min: '0',
      required: true,
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
    },
  ], [activeCaregiverOptions]);

  const handleEditDialogSubmit = async (values: z.infer<typeof editTimeEntrySchema>) => {
    if (!editDialogEntry) return;

    try {
      await updateTimeEntry.mutateAsync({
        id: editDialogEntry.id,
        data: {
          caregiver_id: Number(values.caregiver_id),
          date: values.date,
          time_in: values.time_in || null,
          time_out: values.time_out || null,
          hours: values.hours,
          hourly_rate: values.hourly_rate,
          notes: values.notes || null,
        },
      });
      toast({
        title: 'Updated',
        description: 'Time entry updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update time entry.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Define columns for DataTable
  const columns: ColumnDef<TimeEntry>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: createSortableHeader('Date'),
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <EditableCell
              value={entry.date}
              displayValue={formatDate(entry.date)}
              type="date"
              onSave={(value) => handleInlineUpdate(entry.id, 'date', value)}
            />
          );
        },
      },
      {
        accessorKey: 'caregiver_name',
        header: createSortableHeader('Caregiver'),
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <EditableCell
              value={entry.caregiver_id.toString()}
              displayValue={getCaregiverName(entry.caregiver_id)}
              type="select"
              options={activeCaregiverOptions}
              onSave={(value) => handleInlineUpdate(entry.id, 'caregiver_id', value)}
            />
          );
        },
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
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="text-right">
              <EditableCell
                value={entry.hours}
                type="number"
                step="0.25"
                min="0"
                onSave={(value) => handleInlineUpdate(entry.id, 'hours', value)}
                inputClassName="text-right"
              />
            </div>
          );
        },
      },
      {
        accessorKey: 'hourly_rate',
        header: createSortableHeader('Rate'),
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="text-right">
              <EditableCell
                value={entry.hourly_rate}
                displayValue={formatCurrency(entry.hourly_rate)}
                type="number"
                step="0.01"
                min="0"
                onSave={(value) => handleInlineUpdate(entry.id, 'hourly_rate', value)}
                inputClassName="text-right"
              />
            </div>
          );
        },
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
      {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditDialog(row.original)}
              title="Edit all fields"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteClick(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [activeCaregiverOptions, getCaregiverName, handleInlineUpdate]
  );

  // Footer content for totals
  const footerContent = (
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">Total ({filteredEntries.length} entries)</span>
      <div className="flex items-center gap-8">
        <div>
          <span className="text-muted-foreground">Hours:</span>{' '}
          <span className="font-medium">{totals.hours.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Pay:</span>{' '}
          <span className="font-medium">{formatCurrency(totals.pay)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Time Entries</h2>
        <div className="flex items-center gap-4">
          {/* Period Selector */}
          <Select
            value={selectedPeriodId?.toString() || 'all'}
            onValueChange={(value) =>
              setSelectedPeriodId(value === 'all' ? undefined : Number(value))
            }
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              {periods.map((period) => (
                <SelectItem key={period.id} value={period.id.toString()}>
                  {format(new Date(period.start_date), 'MMM d')} -{' '}
                  {format(new Date(period.end_date), 'MMM d, yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Add Entry Button */}
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) handleDialogClose();
            else setDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
                </DialogTitle>
              </DialogHeader>
              <TimeEntryDialog
                entry={editingEntry}
                caregivers={caregivers}
                periodId={selectedPeriodId}
                onClose={handleDialogClose}
              />
            </DialogContent>
          </Dialog>
        </div>
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

            {/* Caregiver Multi-select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Caregiver
              </label>
              <MultiSelect
                options={caregiverOptions}
                value={selectedCaregivers}
                onChange={setSelectedCaregivers}
                placeholder="All caregivers"
              />
            </div>

            {/* Hours Range */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Hours Range
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={minHours}
                  onChange={(e) => setMinHours(e.target.value)}
                  className="w-20"
                  min="0"
                  step="0.25"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={maxHours}
                  onChange={(e) => setMaxHours(e.target.value)}
                  className="w-20"
                  min="0"
                  step="0.25"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredEntries}
            isLoading={isLoading}
            emptyMessage='No time entries found. Click "Add Entry" to create one.'
            enableRowSelection={true}
            footerContent={filteredEntries.length > 0 ? footerContent : undefined}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Time Entry</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete this time entry? This action cannot
            be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteTimeEntry.isPending}
            >
              {deleteTimeEntry.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Edit Dialog */}
      {editDialogEntry && (
        <EditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          title="Edit Time Entry"
          fields={editDialogFields}
          schema={editTimeEntrySchema}
          defaultValues={{
            caregiver_id: editDialogEntry.caregiver_id.toString(),
            date: editDialogEntry.date,
            time_in: editDialogEntry.time_in || '',
            time_out: editDialogEntry.time_out || '',
            hours: editDialogEntry.hours,
            hourly_rate: editDialogEntry.hourly_rate,
            notes: editDialogEntry.notes || '',
          }}
          onSubmit={handleEditDialogSubmit}
          isLoading={updateTimeEntry.isPending}
        />
      )}
    </div>
  );
}

export default TimeEntries;
