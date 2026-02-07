import { useState, useMemo } from 'react';
import { format, addDays, eachDayOfInterval, getDay } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { TimeEntry } from '@/types';
import type { BulkEntryRow } from './BulkEntryForm';

interface CopyToDateRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntries: TimeEntry[];
  onGenerate: (rows: Partial<BulkEntryRow>[]) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CopyToDateRangeDialog({
  open,
  onOpenChange,
  selectedEntries,
  onGenerate,
}: CopyToDateRangeDialogProps) {
  const [startDate, setStartDate] = useState(
    format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    format(addDays(new Date(), 7), 'yyyy-MM-dd')
  );
  const [includeDays, setIncludeDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [matchDayOfWeek, setMatchDayOfWeek] = useState(false);

  const toggleDay = (day: number) => {
    setIncludeDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Preview: how many entries will be generated
  const preview = useMemo(() => {
    if (!startDate || !endDate) return { dates: [], entryCount: 0 };

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return { dates: [], entryCount: 0 };

    const allDates = eachDayOfInterval({ start, end });
    const filteredDates = allDates.filter((d) => includeDays.includes(getDay(d)));

    if (matchDayOfWeek) {
      // For each source entry, only copy to dates matching that entry's day of week
      let count = 0;
      for (const entry of selectedEntries) {
        const entryDay = getDay(new Date(entry.date));
        count += filteredDates.filter((d) => getDay(d) === entryDay).length;
      }
      return { dates: filteredDates, entryCount: count };
    }

    return {
      dates: filteredDates,
      entryCount: filteredDates.length * selectedEntries.length,
    };
  }, [startDate, endDate, includeDays, matchDayOfWeek, selectedEntries]);

  const handleGenerate = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return;

    const allDates = eachDayOfInterval({ start, end });
    const filteredDates = allDates.filter((d) => includeDays.includes(getDay(d)));

    const rows: Partial<BulkEntryRow>[] = [];

    for (const entry of selectedEntries) {
      const entryDay = getDay(new Date(entry.date));

      for (const date of filteredDates) {
        // If matching day of week, only copy to matching days
        if (matchDayOfWeek && getDay(date) !== entryDay) continue;

        rows.push({
          caregiver_id: entry.caregiver_id.toString(),
          date: format(date, 'yyyy-MM-dd'),
          time_in: entry.time_in || '',
          time_out: entry.time_out || '',
          hours: entry.hours,
          hourly_rate: entry.hourly_rate,
          notes: entry.notes || '',
          isAutoCalculated: false,
        });
      }
    }

    onGenerate(rows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy Entries to Date Range</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <p className="text-sm text-muted-foreground">
            Copying {selectedEntries.length} selected{' '}
            {selectedEntries.length === 1 ? 'entry' : 'entries'} to a new date range.
            You'll be able to review before saving.
          </p>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Day of week selection */}
          <div className="space-y-2">
            <Label>Include days</Label>
            <div className="flex gap-2">
              {DAY_NAMES.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`flex h-8 w-10 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                    includeDays.includes(idx)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Match day of week */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="match-dow"
              checked={matchDayOfWeek}
              onCheckedChange={(checked) => setMatchDayOfWeek(checked === true)}
            />
            <label htmlFor="match-dow" className="text-sm">
              Match original day of week (e.g., Monday entries only copy to Mondays)
            </label>
          </div>

          {/* Preview */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm font-medium">
              Preview: {preview.entryCount} {preview.entryCount === 1 ? 'entry' : 'entries'} will
              be generated
            </p>
            {preview.dates.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Across {preview.dates.length} {preview.dates.length === 1 ? 'day' : 'days'} (
                {format(new Date(startDate), 'MMM d')} - {format(new Date(endDate), 'MMM d, yyyy')})
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={preview.entryCount === 0}
          >
            Generate & Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
