import { format } from 'date-fns';

// ============================================================================
// Decimal ↔ Hours:Minutes Conversion
// ============================================================================

/**
 * Convert decimal hours to "Xh Ym" display string.
 * Examples: 12.5 → "12h 30m", 0.25 → "0h 15m", 8 → "8h 0m"
 */
export function decimalToHoursMinutes(decimal: string | number): string {
  const num = typeof decimal === 'string' ? parseFloat(decimal) : decimal;
  if (isNaN(num) || num < 0) return '0h 0m';
  const hours = Math.floor(num);
  const minutes = Math.round((num - hours) * 60);
  return `${hours}h ${minutes}m`;
}

/**
 * Parse various hours input formats and return a decimal string.
 * Accepts: "12:30", "12h 30m", "12h", "30m", "12.5", plain numbers.
 * Returns decimal string like "12.50".
 */
export function parseHoursInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Match "Xh Ym" pattern (e.g., "12h 30m", "12h", "30m")
  const hmMatch = trimmed.match(/^(\d+)\s*h\s*(?:(\d+)\s*m)?$/i);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = hmMatch[2] ? parseInt(hmMatch[2], 10) : 0;
    return (h + m / 60).toFixed(2);
  }

  // Match minutes-only pattern (e.g., "30m")
  const mOnlyMatch = trimmed.match(/^(\d+)\s*m$/i);
  if (mOnlyMatch) {
    const m = parseInt(mOnlyMatch[1], 10);
    return (m / 60).toFixed(2);
  }

  // Match "H:MM" colon pattern (e.g., "12:30")
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    return (h + m / 60).toFixed(2);
  }

  // Plain number / decimal (e.g., "12.5", "8")
  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return num.toFixed(2);
  }

  return '';
}

// ============================================================================
// Time In/Out → Hours Calculation
// ============================================================================

/**
 * Calculate decimal hours between two HH:MM time strings.
 * Handles overnight shifts (time_out < time_in by adding 24h).
 * Returns decimal string like "12.50".
 */
export function calculateHoursBetween(timeIn: string, timeOut: string): string {
  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);

  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) {
    return '';
  }

  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;

  // Handle overnight shift
  if (outMinutes <= inMinutes) {
    outMinutes += 24 * 60;
  }

  const diffMinutes = outMinutes - inMinutes;
  const hours = diffMinutes / 60;
  return hours.toFixed(2);
}

// ============================================================================
// Formatting Helpers (consolidate duplicated functions)
// ============================================================================

/**
 * Format HH:MM (24h) to "h:mm AM/PM" display string.
 * Returns "-" for null/empty values.
 */
export function formatTimeTo12Hour(time: string | null | undefined): string {
  if (!time) return '-';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  if (isNaN(hour)) return '-';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format a numeric amount as USD currency.
 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Format an ISO date string to "MMM d, yyyy" display format.
 */
export function formatDisplayDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy');
}

// ============================================================================
// Date Range Generation (for Copy-to-Date-Range feature)
// ============================================================================

export interface DateRangeOptions {
  matchDayOfWeek: boolean;
  includeDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

/**
 * Generate dates within a range, filtered by day-of-week options.
 */
export function generateDatesInRange(
  startDate: Date,
  endDate: Date,
  options: DateRangeOptions
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (options.includeDays.includes(current.getDay())) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
