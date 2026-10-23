import { apiClient } from './apiClient';

export interface FinanceBranch {
  id: number;
  code: string;
  name: string;
  status?: string;
}

export interface FinanceCourse {
  id: number;
  code: string;
  name: string;
  status?: string;
}

export interface FinanceFeePlan {
  id: number;
  branchId: number;
  courseId: number;
  classId: number | null;
  name: string;
  amount: number;
  effectiveFrom: string;
  isActive: boolean;
  branch?: FinanceBranch;
  course?: FinanceCourse;
  trainingClass?: { id: number; classCode: string } | null;
}

export interface FinancePayment {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER';
  paidAt: string;
  transactionRef: string | null;
  notes: string | null;
}

export interface FinanceInvoice {
  id: number;
  invoiceNumber: string;
  student: { id: number; studentCode: string; fullName: string };
  branch?: FinanceBranch | null;
  trainingClass?: { id: number; classCode: string } | null;
  feePlan?: FinanceFeePlan | null;
  totalAmount: number;
  discountAmount: number | null;
  finalAmount: number;
  paidAmount: number;
  outstanding: number;
  paymentStatus: string;
  dueDate: string | null;
  overdue: boolean;
  payments: FinancePayment[];
}

export interface FinanceStudent {
  id: number;
  studentCode: string;
  fullName: string;
}

export interface StudentEnrollment {
  id: number;
  status: string;
  trainingClass?: {
    id: number;
    classCode?: string;
    name?: string;
    branchId?: number;
    courseId?: number;
  };
}

export interface FinanceStudentDetail extends FinanceStudent {
  classEnrollments?: StudentEnrollment[];
}

export interface ArrearsItem {
  invoiceId: number;
  invoiceNumber: string;
  student: FinanceStudent;
  class: { id: number; classCode: string } | null;
  amountDue: number;
  dueDate: string;
  status: 'CURRENT' | 'OVERDUE';
  paymentStatus: string;
}

export interface ArrearsResult {
  totals: { totalDebt: number; studentCount: number; overdueTotal: number };
  items: ArrearsItem[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}

type Envelope<T> = { data: T };

function envelopeData<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) return (raw as Envelope<T>).data;
  return raw as T;
}

export function listPayload<T>(raw: unknown): T[] {
  const value = envelopeData<unknown>(raw);
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function fetchBranches(): Promise<FinanceBranch[]> {
  const response = await apiClient.get('/categories/branches');
  return listPayload<FinanceBranch>(response.data);
}

export async function fetchCourses(): Promise<FinanceCourse[]> {
  const response = await apiClient.get('/categories/courses', { params: { page: 1, limit: 100 } });
  const body = response.data as { data?: FinanceCourse[] } | FinanceCourse[];
  return Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];
}

export async function fetchFeePlans(params?: { isActive?: boolean }): Promise<FinanceFeePlan[]> {
  const response = await apiClient.get('/finance/fee-plans', { params });
  return listPayload<FinanceFeePlan>(response.data);
}

export async function saveFeePlan(
  id: number | undefined,
  payload: {
    branchId: number;
    courseId: number;
    classId: number | null;
    name: string;
    amount: number;
    effectiveFrom?: string;
  },
): Promise<FinanceFeePlan> {
  const response = id
    ? await apiClient.patch(`/finance/fee-plans/${id}`, payload)
    : await apiClient.post('/finance/fee-plans', payload);
  return envelopeData<FinanceFeePlan>(response.data);
}

export async function deactivateFeePlan(id: number): Promise<void> {
  await apiClient.post(`/finance/fee-plans/${id}/deactivate`);
}

export async function searchStudents(search: string): Promise<FinanceStudent[]> {
  const response = await apiClient.get('/students', { params: { search } });
  return listPayload<FinanceStudent>(response.data);
}

export async function fetchStudent(id: number): Promise<FinanceStudentDetail> {
  const response = await apiClient.get(`/students/${id}`);
  return envelopeData<FinanceStudentDetail>(response.data);
}

export async function createInvoice(payload: {
  feePlanId: number;
  studentId: number;
  classId?: number;
  dueDate: string;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
}): Promise<FinanceInvoice> {
  const response = await apiClient.post('/finance/invoices', payload);
  return envelopeData<FinanceInvoice>(response.data);
}

export async function fetchInvoice(id: number): Promise<FinanceInvoice> {
  const response = await apiClient.get(`/finance/invoices/${id}`);
  return envelopeData<FinanceInvoice>(response.data);
}

export async function recordPayment(
  invoiceId: number,
  idempotencyKey: string,
  payload: {
    amount: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER';
    paidAt: string;
    transactionRef?: string;
  },
): Promise<{ payment: FinancePayment; invoice: FinanceInvoice }> {
  const response = await apiClient.post(`/finance/invoices/${invoiceId}/payments`, payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return envelopeData<{ payment: FinancePayment; invoice: FinanceInvoice }>(response.data);
}

export async function fetchPayment(id: number): Promise<FinancePayment & { invoice: FinanceInvoice }> {
  const response = await apiClient.get(`/finance/payments/${id}`);
  return envelopeData<FinancePayment & { invoice: FinanceInvoice }>(response.data);
}

export async function downloadReceipt(id: number): Promise<Blob> {
  const response = await apiClient.get(`/finance/payments/${id}/receipt.pdf`, { responseType: 'blob' });
  return response.data as Blob;
}

export type ArrearsFilters = {
  branchId?: number;
  fromDate?: string;
  toDate?: string;
  student?: string;
  status?: 'CURRENT' | 'OVERDUE';
  page?: number;
  pageSize?: number;
};

export async function fetchArrears(params: ArrearsFilters): Promise<ArrearsResult> {
  const response = await apiClient.get('/reports/arrears', { params });
  const body = response.data as {
    data: Omit<ArrearsResult, 'meta'>;
    meta: ArrearsResult['meta'];
  };
  return { ...body.data, meta: body.meta };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' ? message : fallback;
}