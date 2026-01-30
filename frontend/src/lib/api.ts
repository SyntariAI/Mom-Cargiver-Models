import axios from 'axios';
import type {
  Caregiver,
  PayPeriod,
  TimeEntry,
  Expense,
  Settlement,
  ExpenseSummary,
} from '../types';

// In production, use relative URLs (nginx proxies to backend)
// In development, use localhost:8000
const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HTTP Basic Auth credentials with requests
});

// Caregivers
export const caregivers = {
  list: () => api.get<Caregiver[]>('/api/caregivers').then((r) => r.data),
  get: (id: number) => api.get<Caregiver>(`/api/caregivers/${id}`).then((r) => r.data),
  create: (data: Partial<Caregiver>) =>
    api.post<Caregiver>('/api/caregivers', data).then((r) => r.data),
  update: (id: number, data: Partial<Caregiver>) =>
    api.put<Caregiver>(`/api/caregivers/${id}`, data).then((r) => r.data),
  deactivate: (id: number) =>
    api.delete<Caregiver>(`/api/caregivers/${id}`).then((r) => r.data),
};

// Pay Periods
export const payPeriods = {
  list: () => api.get<PayPeriod[]>('/api/pay-periods').then((r) => r.data),
  current: () => api.get<PayPeriod>('/api/pay-periods/current').then((r) => r.data),
  get: (id: number) => api.get<PayPeriod>(`/api/pay-periods/${id}`).then((r) => r.data),
  create: (data: { start_date: string; end_date: string; notes?: string }) =>
    api.post<PayPeriod>('/api/pay-periods', data).then((r) => r.data),
  close: (id: number) =>
    api.post<PayPeriod>(`/api/pay-periods/${id}/close`).then((r) => r.data),
};

// Time Entries
export const timeEntries = {
  list: (periodId?: number) =>
    api
      .get<TimeEntry[]>('/api/time-entries', { params: { period_id: periodId } })
      .then((r) => r.data),
  get: (id: number) => api.get<TimeEntry>(`/api/time-entries/${id}`).then((r) => r.data),
  create: (data: Partial<TimeEntry>) =>
    api.post<TimeEntry>('/api/time-entries', data).then((r) => r.data),
  update: (id: number, data: Partial<TimeEntry>) =>
    api.put<TimeEntry>(`/api/time-entries/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/time-entries/${id}`),
};

// Expenses
export const expenses = {
  list: (periodId?: number) =>
    api
      .get<Expense[]>('/api/expenses', { params: { period_id: periodId } })
      .then((r) => r.data),
  summary: (periodId: number) =>
    api
      .get<ExpenseSummary>('/api/expenses/summary', { params: { period_id: periodId } })
      .then((r) => r.data),
  get: (id: number) => api.get<Expense>(`/api/expenses/${id}`).then((r) => r.data),
  create: (data: Partial<Expense>) =>
    api.post<Expense>('/api/expenses', data).then((r) => r.data),
  update: (id: number, data: Partial<Expense>) =>
    api.put<Expense>(`/api/expenses/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/api/expenses/${id}`),
};

// Settlements
export const settlements = {
  get: (periodId: number) =>
    api.get<Settlement>(`/api/settlements/${periodId}`).then((r) => r.data),
  calculate: (periodId: number) =>
    api.post<Settlement>(`/api/settlements/${periodId}/calculate`).then((r) => r.data),
  markSettled: (periodId: number, paymentMethod?: string) =>
    api
      .post<Settlement>(`/api/settlements/${periodId}/mark-settled`, {
        payment_method: paymentMethod,
      })
      .then((r) => r.data),
};

export default api;
