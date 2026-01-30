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
