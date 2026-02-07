import { useState, useCallback } from 'react';
import { calculateHoursBetween } from '@/lib/time-utils';

/**
 * Hook for auto-calculating hours from time_in and time_out.
 * Tracks whether the user has manually overridden the calculated value.
 */
export function useTimeCalculation() {
  const [isManualOverride, setIsManualOverride] = useState(false);

  /**
   * Calculate hours from time_in and time_out.
   * Returns the decimal hours string, or null if both times aren't provided.
   */
  const calculateFromTimes = useCallback(
    (timeIn: string | undefined | null, timeOut: string | undefined | null): string | null => {
      if (!timeIn || !timeOut) return null;
      const result = calculateHoursBetween(timeIn, timeOut);
      return result || null;
    },
    []
  );

  /**
   * Mark that the user has manually edited the hours field.
   * Subsequent time changes will not auto-update hours.
   */
  const setManualHours = useCallback(() => {
    setIsManualOverride(true);
  }, []);

  /**
   * Reset the manual override flag.
   * Call this when times change and you want auto-calc to resume.
   */
  const clearOverride = useCallback(() => {
    setIsManualOverride(false);
  }, []);

  return {
    calculateFromTimes,
    setManualHours,
    clearOverride,
    isManualOverride,
  };
}
