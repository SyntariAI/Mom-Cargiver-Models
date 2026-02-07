import { useReducer, useRef, useCallback, useMemo } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { Plus, Trash2, Copy, X, Save, AlertCircle, CalendarClock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useBulkCreateTimeEntries, useTimeEntries } from '@/hooks/use-api';
import {
  calculateHoursBetween,
  decimalToHoursMinutes,
  formatCurrency,
} from '@/lib/time-utils';
import type { Caregiver } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface BulkEntryRow {
  id: string;
  caregiver_id: string;
  date: string;
  time_in: string;
  time_out: string;
  hours: string;
  hourly_rate: string;
  notes: string;
  isAutoCalculated: boolean;
  errors: Record<string, string>;
}

interface BulkEntryFormProps {
  periodId: number | undefined;
  caregivers: Caregiver[];
  onClose: () => void;
  initialRows?: Partial<BulkEntryRow>[];
}

// ============================================================================
// Reducer
// ============================================================================

type Action =
  | { type: 'ADD_ROW'; payload?: Partial<BulkEntryRow> }
  | { type: 'REMOVE_ROW'; payload: string }
  | { type: 'UPDATE_CELL'; payload: { id: string; field: string; value: string } }
  | { type: 'DUPLICATE_ROW'; payload: string }
  | { type: 'SET_ROWS'; payload: BulkEntryRow[] }
  | { type: 'VALIDATE_ALL' }
  | { type: 'CLEAR_ERRORS' };

function createEmptyRow(defaults?: Partial<BulkEntryRow>): BulkEntryRow {
  return {
    id: crypto.randomUUID(),
    caregiver_id: defaults?.caregiver_id || '',
    date: defaults?.date || format(new Date(), 'yyyy-MM-dd'),
    time_in: defaults?.time_in || '',
    time_out: defaults?.time_out || '',
    hours: defaults?.hours || '',
    hourly_rate: defaults?.hourly_rate || '',
    notes: defaults?.notes || '',
    isAutoCalculated: defaults?.isAutoCalculated || false,
    errors: {},
  };
}

function validateRow(row: BulkEntryRow): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!row.caregiver_id) errors.caregiver_id = 'Required';
  if (!row.date) errors.date = 'Required';
  if (!row.hours || parseFloat(row.hours) <= 0) errors.hours = 'Required';
  if (row.hours && parseFloat(row.hours) > 24) errors.hours = 'Max 24';
  if (!row.hourly_rate || parseFloat(row.hourly_rate) <= 0) errors.hourly_rate = 'Required';
  return errors;
}

function reducer(state: BulkEntryRow[], action: Action): BulkEntryRow[] {
  switch (action.type) {
    case 'ADD_ROW': {
      const lastRow = state[state.length - 1];
      const defaults: Partial<BulkEntryRow> = action.payload || {};
      // Smart defaults from previous row
      if (lastRow && !action.payload) {
        defaults.caregiver_id = lastRow.caregiver_id;
        defaults.hourly_rate = lastRow.hourly_rate;
        defaults.date = lastRow.date
          ? format(addDays(new Date(lastRow.date), 1), 'yyyy-MM-dd')
          : format(new Date(), 'yyyy-MM-dd');
      }
      return [...state, createEmptyRow(defaults)];
    }
    case 'REMOVE_ROW':
      if (state.length <= 1) return state;
      return state.filter((row) => row.id !== action.payload);
    case 'UPDATE_CELL':
      return state.map((row) => {
        if (row.id !== action.payload.id) return row;
        const updated = { ...row, [action.payload.field]: action.payload.value };
        // Clear error for this field
        if (updated.errors[action.payload.field]) {
          updated.errors = { ...updated.errors };
          delete updated.errors[action.payload.field];
        }
        // Auto-calculate hours when both times are present
        if (
          (action.payload.field === 'time_in' || action.payload.field === 'time_out') &&
          !row.isAutoCalculated === false // not manually overridden
        ) {
          const timeIn = action.payload.field === 'time_in' ? action.payload.value : row.time_in;
          const timeOut = action.payload.field === 'time_out' ? action.payload.value : row.time_out;
          if (timeIn && timeOut) {
            const hours = calculateHoursBetween(timeIn, timeOut);
            if (hours) {
              updated.hours = hours;
              updated.isAutoCalculated = true;
            }
          }
        }
        // If user manually edits hours, mark as not auto-calculated
        if (action.payload.field === 'hours') {
          updated.isAutoCalculated = false;
        }
        return updated;
      });
    case 'DUPLICATE_ROW': {
      const sourceIdx = state.findIndex((r) => r.id === action.payload);
      if (sourceIdx === -1) return state;
      const source = state[sourceIdx];
      const newRow = createEmptyRow({
        caregiver_id: source.caregiver_id,
        date: source.date,
        time_in: source.time_in,
        time_out: source.time_out,
        hours: source.hours,
        hourly_rate: source.hourly_rate,
        notes: source.notes,
        isAutoCalculated: source.isAutoCalculated,
      });
      const newState = [...state];
      newState.splice(sourceIdx + 1, 0, newRow);
      return newState;
    }
    case 'SET_ROWS':
      return action.payload;
    case 'VALIDATE_ALL':
      return state.map((row) => ({ ...row, errors: validateRow(row) }));
    case 'CLEAR_ERRORS':
      return state.map((row) => ({ ...row, errors: {} }));
    default:
      return state;
  }
}

// ============================================================================
// Column fields for keyboard navigation
// ============================================================================

const COLUMNS = ['caregiver_id', 'date', 'time_in', 'time_out', 'hours', 'hourly_rate', 'notes'] as const;

// ============================================================================
// Component
// ============================================================================

export function BulkEntryForm({
  periodId,
  caregivers,
  onClose,
  initialRows,
}: BulkEntryFormProps) {
  const initialState = initialRows?.length
    ? initialRows.map((r) => createEmptyRow(r))
    : [createEmptyRow()];

  const [rows, dispatch] = useReducer(reducer, initialState);
  const bulkCreate = useBulkCreateTimeEntries();
  const { toast } = useToast();
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const activeCaregivers = useMemo(
    () => caregivers.filter((c) => c.is_active),
    [caregivers]
  );

  // Get caregiver's default rate
  const getDefaultRate = useCallback(
    (caregiverId: string) => {
      const caregiver = caregivers.find((c) => c.id === Number(caregiverId));
      return caregiver?.default_hourly_rate || '';
    },
    [caregivers]
  );

  // Focus a specific cell by row index and column name
  const focusCell = useCallback((rowIdx: number, colName: string) => {
    const key = `${rowIdx}-${colName}`;
    const el = cellRefs.current.get(key);
    if (el) {
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        el.focus();
      } else {
        // For Select components, find the trigger button
        const trigger = el.querySelector('button');
        trigger?.focus();
      }
    }
  }, []);

  // Register a cell ref
  const setCellRef = useCallback((rowIdx: number, colName: string, el: HTMLElement | null) => {
    const key = `${rowIdx}-${colName}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  }, []);

  // Handle keyboard navigation
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (rowIdx === rows.length - 1) {
          // Last row — add a new row and focus it
          dispatch({ type: 'ADD_ROW' });
          setTimeout(() => focusCell(rowIdx + 1, COLUMNS[0]), 50);
        } else {
          // Move down same column
          focusCell(rowIdx + 1, COLUMNS[colIdx]);
        }
      }
    },
    [rows.length, focusCell]
  );

  // Handle cell value change
  const handleCellChange = useCallback(
    (id: string, field: string, value: string) => {
      dispatch({ type: 'UPDATE_CELL', payload: { id, field, value } });

      // Auto-fill hourly rate when caregiver changes
      if (field === 'caregiver_id') {
        const row = rows.find((r) => r.id === id);
        if (row && !row.hourly_rate) {
          const rate = getDefaultRate(value);
          if (rate) {
            dispatch({ type: 'UPDATE_CELL', payload: { id, field: 'hourly_rate', value: rate } });
          }
        }
      }
    },
    [rows, getDefaultRate]
  );

  // Submit all rows
  const handleSubmit = async () => {
    dispatch({ type: 'VALIDATE_ALL' });

    // Need to validate synchronously since reducer is async
    const errors = rows.map(validateRow);
    const hasErrors = errors.some((e) => Object.keys(e).length > 0);

    if (hasErrors) {
      const errorCount = errors.filter((e) => Object.keys(e).length > 0).length;
      toast({
        title: 'Validation errors',
        description: `${errorCount} row${errorCount > 1 ? 's have' : ' has'} errors. Please fix them before saving.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const entries = rows.map((row) => ({
        pay_period_id: periodId,
        caregiver_id: Number(row.caregiver_id),
        date: row.date,
        time_in: row.time_in || null,
        time_out: row.time_out || null,
        hours: row.hours,
        hourly_rate: row.hourly_rate,
        notes: row.notes || null,
      }));

      await bulkCreate.mutateAsync(entries);
      toast({
        title: 'Created',
        description: `Successfully created ${entries.length} time ${entries.length === 1 ? 'entry' : 'entries'}.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create time entries. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Summary calculations
  const summary = useMemo(() => {
    const totalHours = rows.reduce((sum, row) => {
      const h = parseFloat(row.hours);
      return sum + (isNaN(h) ? 0 : h);
    }, 0);
    const totalPay = rows.reduce((sum, row) => {
      const h = parseFloat(row.hours);
      const r = parseFloat(row.hourly_rate);
      return sum + (isNaN(h) || isNaN(r) ? 0 : h * r);
    }, 0);
    return { totalHours, totalPay, rowCount: rows.length };
  }, [rows]);

  const errorCount = rows.filter((r) => Object.keys(r.errors).length > 0).length;

  // Quick-fill from last week
  const { data: allEntries = [] } = useTimeEntries(periodId);

  const handleFillFromLastWeek = useCallback(() => {
    const today = new Date();
    const weekAgo = subDays(today, 7);
    const twoWeeksAgo = subDays(today, 14);

    // Find entries from last week (7-14 days ago)
    const lastWeekEntries = allEntries.filter((entry) => {
      const entryDate = new Date(entry.date);
      return entryDate >= twoWeeksAgo && entryDate < weekAgo;
    });

    if (lastWeekEntries.length === 0) {
      toast({
        title: 'No entries found',
        description: 'No time entries found from the previous week to copy.',
        variant: 'destructive',
      });
      return;
    }

    // Shift dates forward by 7 days
    const newRows = lastWeekEntries.map((entry) =>
      createEmptyRow({
        caregiver_id: entry.caregiver_id.toString(),
        date: format(addDays(new Date(entry.date), 7), 'yyyy-MM-dd'),
        time_in: entry.time_in || '',
        time_out: entry.time_out || '',
        hours: entry.hours,
        hourly_rate: entry.hourly_rate,
        notes: entry.notes || '',
        isAutoCalculated: false,
      })
    );

    dispatch({ type: 'SET_ROWS', payload: newRows });
    toast({
      title: 'Filled from last week',
      description: `Loaded ${newRows.length} entries with dates shifted forward 7 days.`,
    });
  }, [allEntries, toast]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="text-lg font-semibold">Bulk Add Time Entries</h3>
          <p className="text-sm text-muted-foreground">
            Add multiple entries at once. Tab between cells, Enter to add rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleFillFromLastWeek}>
            <CalendarClock className="mr-2 h-4 w-4" />
            Fill from Last Week
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={bulkCreate.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {bulkCreate.isPending ? 'Saving...' : `Save ${rows.length} ${rows.length === 1 ? 'Entry' : 'Entries'}`}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {errorCount > 0 && (
        <div className="flex items-center gap-2 border-b bg-destructive/10 px-6 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {errorCount} row{errorCount > 1 ? 's have' : ' has'} errors
        </div>
      )}

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10 px-2 py-2 text-center text-xs font-medium text-muted-foreground">#</th>
              <th className="min-w-[150px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Caregiver *</th>
              <th className="min-w-[140px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Date *</th>
              <th className="min-w-[120px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Time In</th>
              <th className="min-w-[120px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Time Out</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Hours *</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Rate *</th>
              <th className="min-w-[150px] px-2 py-2 text-left text-xs font-medium text-muted-foreground">Notes</th>
              <th className="w-20 px-2 py-2 text-center text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={row.id} className="border-b hover:bg-muted/30">
                {/* Row number */}
                <td className="px-2 py-1 text-center text-xs text-muted-foreground">
                  {rowIdx + 1}
                </td>

                {/* Caregiver */}
                <td className="px-1 py-1">
                  <div ref={(el) => setCellRef(rowIdx, 'caregiver_id', el)}>
                    <Select
                      value={row.caregiver_id}
                      onValueChange={(value) => handleCellChange(row.id, 'caregiver_id', value)}
                    >
                      <SelectTrigger
                        className={`h-8 text-xs ${row.errors.caregiver_id ? 'border-destructive' : ''}`}
                        onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 0)}
                      >
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeCaregivers.map((c) => (
                          <SelectItem key={c.id} value={c.id.toString()}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </td>

                {/* Date */}
                <td className="px-1 py-1">
                  <Input
                    ref={(el) => setCellRef(rowIdx, 'date', el)}
                    type="date"
                    value={row.date}
                    onChange={(e) => handleCellChange(row.id, 'date', e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 1)}
                    className={`h-8 text-xs ${row.errors.date ? 'border-destructive' : ''}`}
                  />
                </td>

                {/* Time In */}
                <td className="px-1 py-1">
                  <Input
                    ref={(el) => setCellRef(rowIdx, 'time_in', el)}
                    type="time"
                    value={row.time_in}
                    onChange={(e) => handleCellChange(row.id, 'time_in', e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 2)}
                    className="h-8 text-xs"
                  />
                </td>

                {/* Time Out */}
                <td className="px-1 py-1">
                  <Input
                    ref={(el) => setCellRef(rowIdx, 'time_out', el)}
                    type="time"
                    value={row.time_out}
                    onChange={(e) => handleCellChange(row.id, 'time_out', e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 3)}
                    className="h-8 text-xs"
                  />
                </td>

                {/* Hours */}
                <td className="px-1 py-1">
                  <div className="relative">
                    <Input
                      ref={(el) => setCellRef(rowIdx, 'hours', el)}
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={row.hours}
                      onChange={(e) => handleCellChange(row.id, 'hours', e.target.value)}
                      onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 4)}
                      className={`h-8 text-xs ${row.errors.hours ? 'border-destructive' : ''}`}
                      placeholder={row.isAutoCalculated ? 'Auto' : '0'}
                    />
                    {row.hours && (
                      <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                        {decimalToHoursMinutes(row.hours)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Hourly Rate */}
                <td className="px-1 py-1">
                  <Input
                    ref={(el) => setCellRef(rowIdx, 'hourly_rate', el)}
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.hourly_rate}
                    onChange={(e) => handleCellChange(row.id, 'hourly_rate', e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 5)}
                    className={`h-8 text-xs ${row.errors.hourly_rate ? 'border-destructive' : ''}`}
                    placeholder="$0.00"
                  />
                </td>

                {/* Notes */}
                <td className="px-1 py-1">
                  <Input
                    ref={(el) => setCellRef(rowIdx, 'notes', el)}
                    type="text"
                    value={row.notes}
                    onChange={(e) => handleCellChange(row.id, 'notes', e.target.value)}
                    onKeyDown={(e) => handleCellKeyDown(e, rowIdx, 6)}
                    className="h-8 text-xs"
                    placeholder="Optional"
                  />
                </td>

                {/* Actions */}
                <td className="px-1 py-1">
                  <div className="flex justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => dispatch({ type: 'DUPLICATE_ROW', payload: row.id })}
                      title="Duplicate row"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => dispatch({ type: 'REMOVE_ROW', payload: row.id })}
                      disabled={rows.length <= 1}
                      title="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer: Add row + Summary */}
      <div className="flex items-center justify-between border-t px-6 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'ADD_ROW' })}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Row
        </Button>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">
            {summary.rowCount} {summary.rowCount === 1 ? 'row' : 'rows'}
          </span>
          <span>
            <span className="text-muted-foreground">Hours:</span>{' '}
            <span className="font-medium">{decimalToHoursMinutes(summary.totalHours)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Est. Pay:</span>{' '}
            <span className="font-medium">{formatCurrency(summary.totalPay)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
