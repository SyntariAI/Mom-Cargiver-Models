import type { TimeEntry } from '@/types';

export interface ValidationWarning {
  entryId: number;
  type: 'overlap' | 'excessive-hours' | 'missing-times';
  message: string;
  severity: 'warning' | 'info';
}

/**
 * Validate a list of time entries and return warnings.
 * Checks for overlapping shifts, excessive daily hours, and missing time_in/time_out.
 */
export function validateTimeEntries(entries: TimeEntry[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Group entries by caregiver and date
  const grouped = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = `${entry.caregiver_id}-${entry.date}`;
    const group = grouped.get(key) || [];
    group.push(entry);
    grouped.set(key, group);
  }

  for (const [, group] of grouped) {
    // Check excessive hours (>24h per caregiver per day)
    const totalHours = group.reduce((sum, e) => sum + parseFloat(e.hours), 0);
    if (totalHours > 24) {
      for (const entry of group) {
        warnings.push({
          entryId: entry.id,
          type: 'excessive-hours',
          message: `Total ${totalHours.toFixed(1)}h for ${entry.caregiver_name || 'this caregiver'} on this date exceeds 24h`,
          severity: 'warning',
        });
      }
    }

    // Check overlapping time ranges
    const withTimes = group.filter((e) => e.time_in && e.time_out);
    for (let i = 0; i < withTimes.length; i++) {
      for (let j = i + 1; j < withTimes.length; j++) {
        if (timesOverlap(withTimes[i], withTimes[j])) {
          warnings.push({
            entryId: withTimes[i].id,
            type: 'overlap',
            message: `Overlapping shift with another entry for ${withTimes[i].caregiver_name || 'this caregiver'}`,
            severity: 'warning',
          });
          warnings.push({
            entryId: withTimes[j].id,
            type: 'overlap',
            message: `Overlapping shift with another entry for ${withTimes[j].caregiver_name || 'this caregiver'}`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // Check entries with hours but no times (informational)
  for (const entry of entries) {
    if (parseFloat(entry.hours) > 0 && !entry.time_in && !entry.time_out) {
      warnings.push({
        entryId: entry.id,
        type: 'missing-times',
        message: 'Entry has hours but no time in/out recorded',
        severity: 'info',
      });
    }
  }

  return warnings;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(a: TimeEntry, b: TimeEntry): boolean {
  if (!a.time_in || !a.time_out || !b.time_in || !b.time_out) return false;

  const aStart = timeToMinutes(a.time_in);
  let aEnd = timeToMinutes(a.time_out);
  const bStart = timeToMinutes(b.time_in);
  let bEnd = timeToMinutes(b.time_out);

  // Handle overnight shifts
  if (aEnd <= aStart) aEnd += 24 * 60;
  if (bEnd <= bStart) bEnd += 24 * 60;

  return aStart < bEnd && bStart < aEnd;
}
