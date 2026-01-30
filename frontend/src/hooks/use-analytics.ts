import { useQuery } from '@tanstack/react-query';
import { analytics } from '../lib/api';

// ============================================================================
// Monthly Trend
// ============================================================================

/**
 * Fetches monthly trend data for costs and hours over time.
 * @param months - Number of months to fetch (default: 12)
 */
export function useMonthlyTrend(months?: number) {
  return useQuery({
    queryKey: ['analytics', 'monthlyTrend', months],
    queryFn: () => analytics.monthlyTrend(months),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}

// ============================================================================
// Caregiver Breakdown
// ============================================================================

/**
 * Fetches caregiver breakdown showing hours and costs per caregiver.
 * @param periodId - Optional pay period ID. If omitted, returns all-time data.
 */
export function useCaregiverBreakdown(periodId?: number) {
  return useQuery({
    queryKey: ['analytics', 'caregiverBreakdown', periodId],
    queryFn: () => analytics.caregiverBreakdown(periodId),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Expense Categories
// ============================================================================

/**
 * Fetches expense breakdown by category.
 * @param periodId - Optional pay period ID. If omitted, returns all-time data.
 */
export function useExpenseCategories(periodId?: number) {
  return useQuery({
    queryKey: ['analytics', 'expenseCategories', periodId],
    queryFn: () => analytics.expenseCategories(periodId),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// All-Time Summary
// ============================================================================

/**
 * Fetches all-time summary statistics including total costs, hours, and averages.
 */
export function useAllTimeSummary() {
  return useQuery({
    queryKey: ['analytics', 'allTimeSummary'],
    queryFn: () => analytics.allTimeSummary(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Period Comparison
// ============================================================================

/**
 * Fetches detailed comparison data for multiple pay periods.
 * @param ids - Array of pay period IDs to compare
 */
export function usePeriodComparison(ids: number[]) {
  return useQuery({
    queryKey: ['analytics', 'periodComparison', ids],
    queryFn: () => analytics.periodComparison(ids),
    enabled: ids.length > 0, // Only run query if there are IDs to compare
    staleTime: 5 * 60 * 1000,
  });
}
