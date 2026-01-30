import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2 } from 'lucide-react';

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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export function TimeEntries() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<TimeEntry | undefined>();

  const { data: periods = [] } = usePayPeriods();
  const { data: caregivers = [] } = useCaregivers();
  const { data: entries = [], isLoading } = useTimeEntries(selectedPeriodId);
  const deleteTimeEntry = useDeleteTimeEntry();

  // Sort entries by date descending
  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [entries]);

  // Calculate totals
  const totals = useMemo(() => {
    return sortedEntries.reduce(
      (acc, entry) => ({
        hours: acc.hours + parseFloat(entry.hours),
        pay: acc.pay + parseFloat(entry.total_pay),
      }),
      { hours: 0, pay: 0 }
    );
  }, [sortedEntries]);

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
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
      } catch (error) {
        console.error('Failed to delete time entry:', error);
      }
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingEntry(undefined);
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    // Time is in HH:MM:SS format, convert to HH:MM AM/PM
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
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

      {/* Time Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p>No time entries found.</p>
              <p className="text-sm">Click "Add Entry" to create one.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Caregiver</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total Pay</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>{entry.caregiver_name || '-'}</TableCell>
                    <TableCell>{formatTime(entry.time_in)}</TableCell>
                    <TableCell>{formatTime(entry.time_out)}</TableCell>
                    <TableCell className="text-right">{entry.hours}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.hourly_rate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.total_pay)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {totals.hours.toFixed(2)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right font-medium">
                    {formatCurrency(totals.pay.toString())}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
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
    </div>
  );
}

export default TimeEntries;
