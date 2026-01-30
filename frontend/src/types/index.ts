export interface Caregiver {
  id: number;
  name: string;
  default_hourly_rate: string;
  is_active: boolean;
  created_at: string;
}

export interface PayPeriod {
  id: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  is_historical: boolean;
  notes: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  pay_period_id: number;
  caregiver_id: number;
  date: string;
  time_in: string | null;
  time_out: string | null;
  hours: string;
  hourly_rate: string;
  total_pay: string;
  notes: string | null;
  caregiver_name?: string;
  created_at: string;
}

export interface Expense {
  id: number;
  pay_period_id: number;
  date: string;
  description: string;
  amount: string;
  paid_by: 'Adi' | 'Rafi';
  category: ExpenseCategory;
  is_recurring: boolean;
  date_estimated: boolean;
  notes: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | 'Rent'
  | 'Utilities'
  | 'Groceries'
  | 'Medical'
  | 'Caregiver Payment'
  | 'Insurance'
  | 'Supplies'
  | 'Other';

export interface Settlement {
  id: number;
  pay_period_id: number;
  total_caregiver_cost: string;
  total_expenses: string;
  adi_paid: string;
  rafi_paid: string;
  settlement_amount: string;
  settlement_direction: 'adi_owes_rafi' | 'rafi_owes_adi' | 'even';
  carryover_amount: string;
  final_amount: string;
  settled: boolean;
  settled_at: string | null;
  payment_method: string | null;
}

export interface ExpenseSummary {
  adi_total: string;
  rafi_total: string;
  by_category: Record<string, string>;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface MonthlyTrendDataPoint {
  month: string;
  year: number;
  total_hours: string;
  total_caregiver_cost: string;
  total_expenses: string;
  total_cost: string;
}

export interface MonthlyTrendResponse {
  data: MonthlyTrendDataPoint[];
  period: {
    start_date: string;
    end_date: string;
  };
}

export interface CaregiverBreakdownItem {
  caregiver_id: number;
  caregiver_name: string;
  total_hours: string;
  total_pay: string;
  percentage_of_hours: number;
  percentage_of_cost: number;
  entry_count: number;
}

export interface CaregiverBreakdownResponse {
  data: CaregiverBreakdownItem[];
  totals: {
    total_hours: string;
    total_cost: string;
  };
  period_id?: number;
}

export interface ExpenseCategoryItem {
  category: ExpenseCategory;
  total_amount: string;
  percentage: number;
  count: number;
}

export interface ExpenseCategoriesResponse {
  data: ExpenseCategoryItem[];
  totals: {
    total_amount: string;
    total_count: number;
  };
  period_id?: number;
}

export interface AllTimeSummary {
  total_periods: number;
  total_hours: string;
  total_caregiver_cost: string;
  total_expenses: string;
  total_cost: string;
  average_monthly_cost: string;
  first_period_date: string | null;
  last_period_date: string | null;
  active_caregivers: number;
  total_caregivers: number;
}

export interface PeriodComparisonItem {
  period_id: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
  total_hours: string;
  total_caregiver_cost: string;
  total_expenses: string;
  total_cost: string;
  caregiver_breakdown: {
    caregiver_id: number;
    caregiver_name: string;
    hours: string;
    cost: string;
  }[];
  expense_breakdown: Record<ExpenseCategory, string>;
}

export interface PeriodComparisonResponse {
  periods: PeriodComparisonItem[];
  averages: {
    avg_hours: string;
    avg_caregiver_cost: string;
    avg_expenses: string;
    avg_total_cost: string;
  };
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResults {
  time_entries: TimeEntry[];
  expenses: Expense[];
  caregivers: Caregiver[];
}
