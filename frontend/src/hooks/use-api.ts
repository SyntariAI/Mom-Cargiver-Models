import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  caregivers,
  payPeriods,
  timeEntries,
  expenses,
  settlements,
} from '../lib/api';
import type {
  Caregiver,
  TimeEntry,
  Expense,
} from '../types';

// ============================================================================
// Caregivers
// ============================================================================

export function useCaregivers() {
  return useQuery({
    queryKey: ['caregivers'],
    queryFn: caregivers.list,
  });
}

export function useCaregiver(id: number) {
  return useQuery({
    queryKey: ['caregivers', id],
    queryFn: () => caregivers.get(id),
    enabled: !!id,
  });
}

export function useCreateCaregiver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Caregiver>) => caregivers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
    },
  });
}

export function useUpdateCaregiver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Caregiver> }) =>
      caregivers.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      queryClient.invalidateQueries({ queryKey: ['caregivers', variables.id] });
    },
  });
}

export function useDeactivateCaregiver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => caregivers.deactivate(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      queryClient.invalidateQueries({ queryKey: ['caregivers', id] });
    },
  });
}

// ============================================================================
// Pay Periods
// ============================================================================

export function usePayPeriods() {
  return useQuery({
    queryKey: ['payPeriods'],
    queryFn: payPeriods.list,
  });
}

export function useCurrentPeriod() {
  return useQuery({
    queryKey: ['payPeriods', 'current'],
    queryFn: payPeriods.current,
  });
}

export function usePayPeriod(id: number) {
  return useQuery({
    queryKey: ['payPeriods', id],
    queryFn: () => payPeriods.get(id),
    enabled: !!id,
  });
}

export function useCreatePayPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { start_date: string; end_date: string; notes?: string }) =>
      payPeriods.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] });
    },
  });
}

export function useClosePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => payPeriods.close(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['payPeriods', id] });
      queryClient.invalidateQueries({ queryKey: ['payPeriods', 'current'] });
    },
  });
}

export function useReopenPeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => payPeriods.reopen(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] });
      queryClient.invalidateQueries({ queryKey: ['payPeriods', id] });
      queryClient.invalidateQueries({ queryKey: ['payPeriods', 'current'] });
    },
  });
}

// ============================================================================
// Time Entries
// ============================================================================

export function useTimeEntries(periodId?: number) {
  return useQuery({
    queryKey: periodId ? ['timeEntries', { periodId }] : ['timeEntries'],
    queryFn: () => timeEntries.list(periodId),
  });
}

export function useTimeEntry(id: number) {
  return useQuery({
    queryKey: ['timeEntries', id],
    queryFn: () => timeEntries.get(id),
    enabled: !!id,
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TimeEntry>) => timeEntries.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      // Also invalidate settlement for this period since time entries affect it
      if (result.pay_period_id) {
        queryClient.invalidateQueries({
          queryKey: ['settlements', result.pay_period_id],
        });
      }
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TimeEntry> }) =>
      timeEntries.update(id, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      queryClient.invalidateQueries({ queryKey: ['timeEntries', variables.id] });
      // Also invalidate settlement for this period
      if (result.pay_period_id) {
        queryClient.invalidateQueries({
          queryKey: ['settlements', result.pay_period_id],
        });
      }
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => timeEntries.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
      // Invalidate all settlements since we don't know which period was affected
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });
}

// ============================================================================
// Expenses
// ============================================================================

export function useExpenses(periodId?: number) {
  return useQuery({
    queryKey: periodId ? ['expenses', { periodId }] : ['expenses'],
    queryFn: () => expenses.list(periodId),
  });
}

export function useExpenseSummary(periodId: number) {
  return useQuery({
    queryKey: ['expenses', 'summary', periodId],
    queryFn: () => expenses.summary(periodId),
    enabled: !!periodId,
  });
}

export function useExpense(id: number) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expenses.get(id),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Expense>) => expenses.create(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      // Also invalidate expense summary and settlement for this period
      if (result.pay_period_id) {
        queryClient.invalidateQueries({
          queryKey: ['expenses', 'summary', result.pay_period_id],
        });
        queryClient.invalidateQueries({
          queryKey: ['settlements', result.pay_period_id],
        });
      }
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Expense> }) =>
      expenses.update(id, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expenses', variables.id] });
      // Also invalidate expense summary and settlement for this period
      if (result.pay_period_id) {
        queryClient.invalidateQueries({
          queryKey: ['expenses', 'summary', result.pay_period_id],
        });
        queryClient.invalidateQueries({
          queryKey: ['settlements', result.pay_period_id],
        });
      }
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      // Invalidate all expense summaries and settlements
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    },
  });
}

// ============================================================================
// Settlements
// ============================================================================

export function useSettlement(periodId: number) {
  return useQuery({
    queryKey: ['settlements', periodId],
    queryFn: () => settlements.get(periodId),
    enabled: !!periodId,
  });
}

export function useCalculateSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number) => settlements.calculate(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['settlements', periodId] });
    },
  });
}

export function useMarkSettled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      periodId,
      paymentMethod,
    }: {
      periodId: number;
      paymentMethod?: string;
    }) => settlements.markSettled(periodId, paymentMethod),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['settlements', variables.periodId],
      });
      // Also invalidate pay periods since settlement status may affect display
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] });
    },
  });
}

export function useUnsettle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (periodId: number) => settlements.unsettle(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({
        queryKey: ['settlements', periodId],
      });
      // Also invalidate pay periods since settlement status may affect display
      queryClient.invalidateQueries({ queryKey: ['payPeriods'] });
    },
  });
}
