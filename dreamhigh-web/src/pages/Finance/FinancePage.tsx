import { useMemo, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Plus, RefreshCw, Search, Wallet } from 'lucide-react';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, Select } from '../../design-system/components/ui/Input';
import { fetchClasses } from '../../services/schedulingApi';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatVND } from '../../utils/formatVND';
import {
  apiErrorMessage,
  createInvoice,
  deactivateFeePlan,
  downloadReceipt,
  fetchArrears,
  fetchBranches,
  fetchCourses,
  fetchFeePlans,
  fetchInvoice,
  fetchPayment,
  fetchStudent,
  recordPayment,
  saveFeePlan,
  searchStudents,
  type ArrearsFilters,
  type FinanceFeePlan,
  type FinanceStudent,
} from '../../services/financeApi';

type FinanceTab = 'invoices' | 'fee-plans' | 'arrears';

const localDateString = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const localDateTimeString = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const getErrorText = (error: unknown, fallback: string) => apiErrorMessage(error, fallback);

export default function FinancePage() {
  const authUser = useAuthStore((state) => state.user);
  const roles = authUser?.roles ?? [];
  const canManagePlans = roles.includes('ADMIN') || roles.includes('MANAGER');
  const [tab, setTab] = useState<FinanceTab>('invoices');

  const branchesQuery = useQuery({ queryKey: ['finance-branches'], queryFn: fetchBranches });
  const coursesQuery = useQuery({ queryKey: ['finance-courses'], queryFn: fetchCourses });
  const feePlansQuery = useQuery({ queryKey: ['finance-fee-plans'], queryFn: () => fetchFeePlans() });
  const userBranchIds = Array.isArray(authUser?.branchIds) ? authUser.branchIds as number[] : [];
  const isAdmin = roles.includes('ADMIN');
  const branches = (branchesQuery.data ?? []).filter((branch) => isAdmin || userBranchIds.includes(branch.id));

  return (
    <AppLayout>
      <PageHeader
        title="Tài chính"
        breadcrumb={[{ label: 'Nghiệp vụ đào tạo', href: '/dashboard' }, { label: 'Tài chính' }]}
        action={<span className="inline-flex items-center gap-2 font-label text-xs uppercase text-midnight/45"><Wallet size={16} /> Thu học phí &amp; công nợ</span>}
      />

      {(branchesQuery.isError || coursesQuery.isError || feePlansQuery.isError) && (
        <Card className="mb-6 border-l-4 border-error p-4" role="alert">
          <p className="font-body text-sm text-error">Không tải được một phần dữ liệu danh mục tài chính.</p>
          <Button type="button" variant="ghost" className="mt-2" onClick={() => {
            void branchesQuery.refetch();
            void coursesQuery.refetch();
            void feePlansQuery.refetch();
          }}><RefreshCw size={15} /> Thử tải lại</Button>
        </Card>
      )}

      {!isAdmin && userBranchIds.length === 0 && (
        <Card className="mb-6 border-l-4 border-warning p-4" role="status">
          Tài khoản chưa được gán chi nhánh. API sẽ tiếp tục kiểm tra quyền truy cập; hãy liên hệ quản trị viên để được cấp phạm vi tài chính.
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-midnight/10" role="tablist" aria-label="Các màn hình tài chính">
        {([
          ['invoices', 'Hóa đơn & thu tiền'],
          ['fee-plans', 'Khung học phí'],
          ['arrears', 'Công nợ'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            id={`finance-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`border-b-2 px-4 py-3 font-label text-xs uppercase transition-colors ${tab === value ? 'border-gold text-midnight' : 'border-transparent text-midnight/45 hover:text-midnight'}`}
          >{label}</button>
        ))}
      </div>

      {tab === 'invoices' && <InvoicePanel feePlans={feePlansQuery.data ?? []} feePlansLoading={feePlansQuery.isLoading} />}
      {tab === 'fee-plans' && <FeePlanPanel branches={branches} canManage={canManagePlans} />}
      {tab === 'arrears' && <ArrearsPanel branches={branches} />}
    </AppLayout>
  );
}

function InvoicePanel({
  feePlans,
  feePlansLoading,
}: {
  feePlans: FinanceFeePlan[];
  feePlansLoading: boolean;
}) {
  const queryClient = useQueryClient();
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<FinanceStudent | null>(null);
  const [feePlanId, setFeePlanId] = useState('');
  const [classId, setClassId] = useState('');
  const [dueDate, setDueDate] = useState(localDateString);
  const [discountType, setDiscountType] = useState('');
  const [discountValue, setDiscountValue] = useState('');
  const [invoiceIdInput, setInvoiceIdInput] = useState('');
  const [activeInvoiceId, setActiveInvoiceId] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [paidAt, setPaidAt] = useState(localDateTimeString);
  const [transactionRef, setTransactionRef] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [paymentDetailId, setPaymentDetailId] = useState(0);
  const [receiptError, setReceiptError] = useState('');

  const activePlans = feePlans.filter((plan) => plan.isActive);
  const selectedPlan = activePlans.find((plan) => String(plan.id) === feePlanId);
  const studentsQuery = useQuery({
    queryKey: ['finance-student-search', studentSearch.trim()],
    enabled: studentSearch.trim().length >= 2 && !selectedStudent,
    queryFn: () => searchStudents(studentSearch.trim()),
  });
  const studentQuery = useQuery({
    queryKey: ['finance-student-detail', selectedStudent?.id],
    enabled: selectedStudent !== null,
    queryFn: () => fetchStudent(selectedStudent!.id),
  });
  const studentClasses = (studentQuery.data?.classEnrollments ?? []).filter((enrollment) => {
    const trainingClass = enrollment.trainingClass;
    if (!trainingClass || !selectedPlan) return false;
    return enrollment.status === 'ACTIVE' && trainingClass.branchId === selectedPlan.branchId &&
      trainingClass.courseId === selectedPlan.courseId &&
      (selectedPlan.classId === null || trainingClass.id === selectedPlan.classId);
  });
  const selectedClassId = classId || (studentClasses.length === 1 ? String(studentClasses[0].trainingClass?.id ?? '') : '');

  const invoiceNumber = Number.parseInt(invoiceIdInput, 10);
  const invoiceQuery = useQuery({
    queryKey: ['finance-invoice', activeInvoiceId],
    enabled: activeInvoiceId > 0,
    queryFn: () => fetchInvoice(activeInvoiceId),
  });
  const invoice = invoiceQuery.data;
  const paymentQuery = useQuery({
    queryKey: ['finance-payment', paymentDetailId],
    enabled: paymentDetailId > 0,
    queryFn: () => fetchPayment(paymentDetailId),
  });

  const invoiceMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: async (created) => {
      setInvoiceIdInput(String(created.id));
      setActiveInvoiceId(created.id);
      setSelectedStudent(null);
      setStudentSearch('');
      setFeePlanId('');
      setClassId('');
      setDiscountType('');
      setDiscountValue('');
      await queryClient.invalidateQueries({ queryKey: ['finance-invoice', created.id] });
    },
  });
  const paymentMutation = useMutation({
    mutationFn: ({ key, amount, method, date, reference }: {
      key: string;
      amount: number;
      method: 'CASH' | 'BANK_TRANSFER';
      date: string;
      reference: string;
    }) => recordPayment(activeInvoiceId, key, {
      amount,
      paymentMethod: method,
      paidAt: new Date(date).toISOString(),
      transactionRef: reference.trim() || undefined,
    }),
    onSuccess: async ({ payment }) => {
      setIdempotencyKey('');
      setPaymentAmount('');
      setTransactionRef('');
      setPaymentDetailId(payment.id);
      await queryClient.invalidateQueries({ queryKey: ['finance-invoice', activeInvoiceId] });
    },
  });
  const receiptMutation = useMutation({
    mutationFn: async (paymentId: number) => ({ paymentId, blob: await downloadReceipt(paymentId) }),
    onSuccess: ({ paymentId, blob }) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `receipt-${paymentId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setReceiptError('');
    },
    onError: (error) => setReceiptError(getErrorText(error, 'Không tải được phiếu thu.')),
  });

  const baseAmount = selectedPlan?.amount ?? 0;
  const discountEstimate = discountType === 'PERCENTAGE'
    ? Math.floor(baseAmount * (Number(discountValue) || 0) / 100)
    : discountType === 'FIXED' ? Number(discountValue) || 0 : 0;
  const invoiceEstimate = Math.max(0, baseAmount - discountEstimate);
  const eligibleClasses = selectedPlan?.classId ? studentClasses.filter((item) => item.trainingClass?.id === selectedPlan.classId) : studentClasses;

  const submitInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudent || !selectedPlan || !dueDate) return;
    invoiceMutation.mutate({
      feePlanId: selectedPlan.id,
      studentId: selectedStudent.id,
      ...(selectedPlan.classId === null && selectedClassId ? { classId: Number(selectedClassId) } : {}),
      dueDate,
      ...(discountType ? { discountType: discountType as 'PERCENTAGE' | 'FIXED', discountValue: Number(discountValue) } : {}),
    });
  };

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(paymentAmount);
    if (!invoice || !Number.isInteger(amount) || amount <= 0 || amount > invoice.outstanding) return;
    const key = idempotencyKey || (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    setIdempotencyKey(key);
    paymentMutation.mutate({ key, amount, method: paymentMethod, date: paidAt, reference: transactionRef });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(440px,1.15fr)]">
      <Card className="p-5 shadow-sm">
        <h2 className="mb-5 font-label text-sm font-semibold uppercase tracking-wider text-midnight">Tạo hóa đơn</h2>
        <form className="space-y-4" onSubmit={submitInvoice}>
          <div>
            <Input
              label="Tìm học viên"
              value={selectedStudent ? `${selectedStudent.fullName} · ${selectedStudent.studentCode}` : studentSearch}
              placeholder="Nhập tên hoặc mã học viên"
              onChange={(event) => {
                setSelectedStudent(null);
                setStudentSearch(event.target.value);
              }}
              autoComplete="off"
            />
            {studentsQuery.isLoading && <p className="mt-2 text-sm text-midnight/50">Đang tìm học viên...</p>}
            {studentsQuery.isError && <InlineError message={getErrorText(studentsQuery.error, 'Không tìm được học viên.')} onRetry={() => void studentsQuery.refetch()} />}
            {studentSearch.trim().length >= 2 && !selectedStudent && !studentsQuery.isLoading && studentsQuery.data?.length === 0 && (
              <p className="mt-2 text-sm text-midnight/50">Không có học viên phù hợp.</p>
            )}
            {!selectedStudent && (studentsQuery.data?.length ?? 0) > 0 && (
              <ul className="mt-2 max-h-44 overflow-y-auto border border-midnight/10" aria-label="Kết quả tìm học viên">
                {studentsQuery.data?.map((student) => (
                  <li key={student.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gold/10" onClick={() => {
                      setSelectedStudent(student);
                      setStudentSearch('');
                    }}>
                      {student.fullName} <span className="text-midnight/50">· {student.studentCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Select label="Khung học phí · khóa học/lớp" value={feePlanId} required onChange={(event) => setFeePlanId(event.target.value)}>
            <option value="">Chọn khung phí đang áp dụng</option>
            {activePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {plan.course?.name ?? `Khóa #${plan.courseId}`} · {plan.branch?.name ?? `CN #${plan.branchId}`} · {formatVND(plan.amount)}
              </option>
            ))}
          </Select>
          {feePlansLoading && <p className="text-xs text-midnight/45">Đang tải khung học phí...</p>}
          {!feePlansLoading && activePlans.length === 0 && <p className="text-xs text-midnight/50">Chưa có khung học phí đang áp dụng.</p>}

          {selectedPlan && selectedStudent && selectedPlan.classId === null && (
            <Select
              label="Lớp đang học"
              value={selectedClassId}
              required={eligibleClasses.length > 0}
              onChange={(event) => setClassId(event.target.value)}
            >
              <option value="">Chọn lớp phù hợp</option>
              {eligibleClasses.map((enrollment) => (
                <option key={enrollment.id} value={enrollment.trainingClass?.id}>
                  {enrollment.trainingClass?.classCode ?? enrollment.trainingClass?.name ?? `Lớp #${enrollment.trainingClass?.id}`}
                </option>
              ))}
            </Select>
          )}
          {selectedPlan && selectedStudent && studentQuery.isLoading && <p className="text-xs text-midnight/50">Đang kiểm tra lớp ghi danh...</p>}
          {selectedPlan && selectedStudent && studentQuery.isError && <InlineError message={getErrorText(studentQuery.error, 'Không tải được lớp ghi danh.')} onRetry={() => void studentQuery.refetch()} />}
          {selectedPlan && selectedStudent && !studentQuery.isLoading && eligibleClasses.length === 0 && (
            <p className="border-l-2 border-warning bg-warning/10 p-3 text-sm text-midnight/75">
              Không thấy lớp đang học khớp chi nhánh/khóa học của khung phí. API sẽ từ chối tạo hóa đơn nếu học viên không có ghi danh hợp lệ.
            </p>
          )}

          <Input label="Ngày đến hạn" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Ưu đãi (tùy chọn)" value={discountType} onChange={(event) => {
              setDiscountType(event.target.value);
              setDiscountValue('');
            }}>
              <option value="">Không có</option>
              <option value="PERCENTAGE">Phần trăm</option>
              <option value="FIXED">Số tiền (VND)</option>
            </Select>
            {discountType && <Input label={discountType === 'PERCENTAGE' ? 'Mức giảm (%)' : 'Mức giảm (VND)'} type="number" min="0" step={discountType === 'PERCENTAGE' ? '0.01' : '1'} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} required />}
          </div>
          {selectedPlan && (
            <dl className="grid grid-cols-2 gap-y-1 border-y border-midnight/10 py-3 text-sm">
              <dt className="text-midnight/55">Học phí gốc</dt><dd className="text-right">{formatVND(baseAmount)}</dd>
              <dt className="text-midnight/55">Ước tính sau ưu đãi</dt><dd className="text-right font-semibold">{formatVND(invoiceEstimate)}</dd>
            </dl>
          )}
          {invoiceMutation.isError && <p role="alert" className="text-sm text-error">{getErrorText(invoiceMutation.error, 'Không tạo được hóa đơn.')}</p>}
          {invoiceMutation.isSuccess && <p role="status" className="text-sm text-success">Hóa đơn đã được tạo và lưu trên hệ thống.</p>}
          <Button type="submit" disabled={!selectedStudent || !selectedPlan || !dueDate || invoiceMutation.isPending || studentQuery.isLoading || studentQuery.isError || eligibleClasses.length === 0 || (eligibleClasses.length > 1 && !selectedClassId)}>
            <Plus size={16} /> {invoiceMutation.isPending ? 'Đang tạo...' : 'Tạo hóa đơn'}
          </Button>
        </form>
      </Card>

      <div className="space-y-6">
        <Card className="p-5 shadow-sm">
          <h2 className="mb-4 font-label text-sm font-semibold uppercase tracking-wider text-midnight">Tra cứu hóa đơn &amp; thanh toán</h2>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => {
            event.preventDefault();
            if (Number.isInteger(invoiceNumber) && invoiceNumber > 0) {
              setPaymentDetailId(0);
              setActiveInvoiceId(invoiceNumber);
            }
          }}>
            <Input label="Mã hóa đơn (ID)" type="number" min="1" value={invoiceIdInput} onChange={(event) => setInvoiceIdInput(event.target.value)} placeholder="Nhập ID hóa đơn" />
            <Button type="submit" variant="secondary" disabled={!Number.isInteger(invoiceNumber) || invoiceNumber < 1}><Search size={16} /> Tra cứu</Button>
          </form>
          {invoiceQuery.isLoading && <p className="mt-4 text-sm text-midnight/50">Đang tải hóa đơn...</p>}
          {invoiceQuery.isError && <InlineError message={getErrorText(invoiceQuery.error, 'Không tải được hóa đơn.')} onRetry={() => void invoiceQuery.refetch()} />}
          {invoice && (
            <div className="mt-5 border-t border-midnight/10 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-label text-xs uppercase text-midnight/45">{invoice.invoiceNumber}</p>
                  <p className="mt-1 font-body text-lg font-medium">{invoice.student.fullName} <span className="text-sm text-midnight/45">· {invoice.student.studentCode}</span></p>
                  <p className="text-sm text-midnight/55">{invoice.feePlan?.name ?? 'Hóa đơn'} · Hạn {formatDate(invoice.dueDate)}</p>
                </div>
                <StatusPill status={invoice.paymentStatus} overdue={invoice.overdue} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 border-y border-midnight/10 py-3 text-sm sm:grid-cols-4">
                <Metric label="Tổng" value={formatVND(invoice.finalAmount)} />
                <Metric label="Đã thu" value={formatVND(invoice.paidAmount)} />
                <Metric label="Còn nợ" value={formatVND(invoice.outstanding)} />
                <Metric label="Hạn thu" value={formatDate(invoice.dueDate)} />
              </dl>

              {invoice.outstanding > 0 && (
                <form className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitPayment}>
                  <Input label="Số tiền thu (VND)" type="number" min="1" max={invoice.outstanding} step="1" value={paymentAmount} onChange={(event) => {
                    setPaymentAmount(event.target.value);
                    setIdempotencyKey('');
                  }} required />
                  <Select label="Phương thức" value={paymentMethod} onChange={(event) => {
                    setPaymentMethod(event.target.value as 'CASH' | 'BANK_TRANSFER');
                    setIdempotencyKey('');
                  }}>
                    <option value="CASH">Tiền mặt</option>
                    <option value="BANK_TRANSFER">Chuyển khoản</option>
                  </Select>
                  <Input label="Thời điểm thu" type="datetime-local" value={paidAt} onChange={(event) => {
                    setPaidAt(event.target.value);
                    setIdempotencyKey('');
                  }} required />
                  <Input label="Mã tham chiếu (tùy chọn)" value={transactionRef} onChange={(event) => {
                    setTransactionRef(event.target.value);
                    setIdempotencyKey('');
                  }} maxLength={100} />
                  <div className="sm:col-span-2">
                    {paymentMutation.isError && <p role="alert" className="mb-3 text-sm text-error">{getErrorText(paymentMutation.error, 'Không ghi nhận được thanh toán. Có thể thử lại cùng nội dung.')}</p>}
                    <Button type="submit" disabled={!paymentAmount || !Number.isInteger(Number(paymentAmount)) || Number(paymentAmount) > invoice.outstanding || paymentMutation.isPending}>
                      {paymentMutation.isPending ? 'Đang ghi nhận...' : 'Ghi nhận thanh toán'}
                    </Button>
                  </div>
                </form>
              )}

              <div className="mt-6">
                <h3 className="mb-2 font-label text-xs font-semibold uppercase tracking-wider text-midnight/65">Lịch sử thanh toán</h3>
                {invoice.payments.length === 0 ? <p className="text-sm text-midnight/45">Chưa có giao dịch thanh toán.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-left text-sm">
                      <thead><tr className="border-b border-midnight/10 text-xs uppercase text-midnight/45"><th className="py-2">Ngày thu</th><th>Mã giao dịch</th><th>Phương thức</th><th className="text-right">Số tiền</th><th className="text-right">Phiếu thu</th></tr></thead>
                      <tbody className="divide-y divide-midnight/5">
                        {invoice.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="py-3">{formatDateTime(payment.paidAt)}</td>
                            <td><button type="button" className="text-gold underline" onClick={() => setPaymentDetailId(payment.id)}>#{payment.id}</button>{payment.transactionRef ? ` · ${payment.transactionRef}` : ''}</td>
                            <td>{payment.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                            <td className="text-right">{formatVND(payment.amount)}</td>
                            <td className="text-right"><Button type="button" variant="ghost" className="!h-8 !px-2" disabled={receiptMutation.isPending} onClick={() => receiptMutation.mutate(payment.id)} aria-label={`Tải phiếu thu giao dịch ${payment.id}`}><Download size={16} /> PDF</Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {receiptMutation.isPending && <p className="mt-2 text-xs text-midnight/50">Đang tải phiếu thu...</p>}
                {receiptError && <InlineError message={receiptError} onRetry={() => {
                  const failedId = receiptMutation.variables;
                  if (failedId) receiptMutation.mutate(failedId);
                }} />}
              </div>
            </div>
          )}
          {!invoice && !invoiceQuery.isLoading && !invoiceQuery.isError && <p className="mt-4 text-sm text-midnight/45">Tra cứu hóa đơn bằng ID để xem số dư, lịch sử và thu tiền.</p>}
        </Card>

        {paymentDetailId > 0 && (
          <Card className="p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-label text-sm font-semibold uppercase tracking-wider text-midnight">Chi tiết giao dịch #{paymentDetailId}</h2>
              <Button type="button" variant="ghost" onClick={() => setPaymentDetailId(0)}>Đóng</Button>
            </div>
            {paymentQuery.isLoading ? <p className="mt-3 text-sm text-midnight/50">Đang tải giao dịch...</p> : paymentQuery.isError ? (
              <InlineError message={getErrorText(paymentQuery.error, 'Không tải được giao dịch.')} onRetry={() => void paymentQuery.refetch()} />
            ) : paymentQuery.data && (
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Hóa đơn" value={paymentQuery.data.invoice.invoiceNumber} />
                <Metric label="Học viên" value={paymentQuery.data.invoice.student.fullName} />
                <Metric label="Số tiền" value={formatVND(paymentQuery.data.amount)} />
                <Metric label="Ngày thu" value={formatDateTime(paymentQuery.data.paidAt)} />
                <Metric label="Tham chiếu" value={paymentQuery.data.transactionRef ?? '—'} />
                <Metric label="Còn nợ sau giao dịch" value={formatVND(paymentQuery.data.invoice.outstanding)} />
              </dl>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function FeePlanPanel({
  branches,
  canManage,
}: {
  branches: Array<{ id: number; code: string; name: string }>;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FinanceFeePlan | null>(null);
  const [branchId, setBranchId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const branchesQuery = useQuery({ queryKey: ['finance-branches'], queryFn: fetchBranches });
  const coursesQuery = useQuery({ queryKey: ['finance-courses'], queryFn: fetchCourses });
  const plansQuery = useQuery({ queryKey: ['finance-fee-plans'], queryFn: () => fetchFeePlans() });
  const classesQuery = useQuery({
    queryKey: ['finance-plan-classes', branchId, courseId],
    enabled: Boolean(branchId && courseId),
    queryFn: async () => (await fetchClasses({ branchId: Number(branchId), courseId: Number(courseId), limit: 100 })).items,
  });

  const resetForm = () => {
    setEditing(null);
    setBranchId('');
    setCourseId('');
    setClassId('');
    setName('');
    setAmount('');
    setEffectiveFrom('');
  };
  const saveMutation = useMutation({
    mutationFn: () => saveFeePlan(editing?.id, {
      branchId: Number(branchId),
      courseId: Number(courseId),
      classId: classId ? Number(classId) : null,
      name: name.trim(),
      amount: Number(amount),
      ...(effectiveFrom ? { effectiveFrom } : {}),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance-fee-plans'] });
      resetForm();
    },
  });
  const deactivateMutation = useMutation({
    mutationFn: deactivateFeePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finance-fee-plans'] }),
  });

  const courses = (coursesQuery.data ?? []).filter((course) => course.status === undefined || course.status === 'ACTIVE');
  const plans = plansQuery.data ?? [];
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branchId || !courseId || !name.trim() || !Number.isInteger(Number(amount)) || Number(amount) < 0) return;
    saveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <Card className="p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-label text-sm font-semibold uppercase tracking-wider text-midnight">{editing ? 'Cập nhật khung học phí' : 'Tạo khung học phí'}</h2>
            {editing && <Button type="button" variant="ghost" onClick={resetForm}>Hủy chỉnh sửa</Button>}
          </div>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={onSubmit}>
            <Select label="Chi nhánh" value={branchId} required onChange={(event) => {
              setBranchId(event.target.value);
              setClassId('');
            }}>
              <option value="">Chọn chi nhánh</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
            </Select>
            <Select label="Khóa học" value={courseId} required onChange={(event) => {
              setCourseId(event.target.value);
              setClassId('');
            }}>
              <option value="">Chọn khóa học</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name} ({course.code})</option>)}
            </Select>
            <Select label="Phạm vi lớp (không bắt buộc)" value={classId} onChange={(event) => setClassId(event.target.value)} disabled={!branchId || !courseId}>
              <option value="">Áp dụng cho toàn khóa học</option>
              {(classesQuery.data ?? []).map((trainingClass) => <option key={trainingClass.id} value={trainingClass.id}>{trainingClass.classCode}</option>)}
            </Select>
            <Input label="Tên khung học phí" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} required />
            <Input label="Số tiền (VND)" type="number" min="0" max="2147483647" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            <Input label="Ngày hiệu lực (tùy chọn)" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
            <div className="flex flex-wrap items-end gap-3 sm:col-span-2 xl:col-span-3">
              <Button type="submit" disabled={saveMutation.isPending || branches.length === 0 || courses.length === 0}>
                {saveMutation.isPending ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo khung phí'}
              </Button>
              <p className="text-xs text-midnight/45">Chi nhánh và lớp sẽ được máy chủ xác minh theo quyền tài khoản.</p>
            </div>
          </form>
          {(branchesQuery.isError || coursesQuery.isError || classesQuery.isError) && (
            <InlineError message="Không tải được danh mục chi nhánh/khóa học/lớp." onRetry={() => {
              void branchesQuery.refetch();
              void coursesQuery.refetch();
              void classesQuery.refetch();
            }} />
          )}
          {saveMutation.isError && <p role="alert" className="mt-3 text-sm text-error">{getErrorText(saveMutation.error, 'Không lưu được khung học phí.')}</p>}
          {saveMutation.isSuccess && <p role="status" className="mt-3 text-sm text-success">Đã lưu khung học phí.</p>}
          {deactivateMutation.isError && <p role="alert" className="mt-3 text-sm text-error">{getErrorText(deactivateMutation.error, 'Không thể ngừng khung học phí.')}</p>}
        </Card>
      )}

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight/10 p-5">
          <h2 className="font-label text-sm font-semibold uppercase tracking-wider text-midnight">Khung học phí</h2>
          <Button type="button" variant="ghost" onClick={() => void plansQuery.refetch()}><RefreshCw size={15} /> Làm mới</Button>
        </div>
        {plansQuery.isLoading ? <div className="p-8 text-center text-sm text-midnight/50">Đang tải khung học phí...</div> : plansQuery.isError ? (
          <div className="p-5"><InlineError message={getErrorText(plansQuery.error, 'Không tải được khung học phí.')} onRetry={() => void plansQuery.refetch()} /></div>
        ) : plans.length === 0 ? <div className="p-8 text-center text-sm text-midnight/50">Chưa có khung học phí.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="bg-midnight/5 text-xs uppercase text-midnight/50"><th className="px-5 py-3">Tên</th><th>Chi nhánh</th><th>Khóa / lớp</th><th className="text-right">Học phí</th><th>Trạng thái</th><th className="px-5 text-right">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-midnight/5">
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="px-5 py-3 font-medium">{plan.name}</td>
                    <td>{plan.branch?.name ?? `#${plan.branchId}`}</td>
                    <td>{plan.course?.name ?? `Khóa #${plan.courseId}`} · {plan.trainingClass?.classCode ?? 'Toàn khóa'}</td>
                    <td className="text-right">{formatVND(plan.amount)}</td>
                    <td><span className={plan.isActive ? 'text-success' : 'text-midnight/40'}>{plan.isActive ? 'Đang áp dụng' : 'Đã ngừng'}</span></td>
                    <td className="px-5 py-3 text-right">
                      {canManage && <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" className="!h-8 !px-2" onClick={() => {
                          setEditing(plan);
                          setBranchId(String(plan.branchId));
                          setCourseId(String(plan.courseId));
                          setClassId(plan.classId ? String(plan.classId) : '');
                          setName(plan.name);
                          setAmount(String(plan.amount));
                          setEffectiveFrom(plan.effectiveFrom?.slice(0, 10) ?? '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>Sửa</Button>
                        {plan.isActive && <Button type="button" variant="ghost" className="!h-8 !px-2 text-error" disabled={deactivateMutation.isPending} onClick={() => {
                          if (window.confirm(`Ngừng áp dụng khung “${plan.name}”?`)) deactivateMutation.mutate(plan.id);
                        }}>Ngừng</Button>}
                      </div>}
                      {!canManage && <span className="text-xs text-midnight/35">Chỉ xem</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ArrearsPanel({ branches }: { branches: Array<{ id: number; code: string; name: string }> }) {
  const [branchId, setBranchId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [student, setStudent] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const filters = useMemo<ArrearsFilters>(() => ({
    ...(branchId ? { branchId: Number(branchId) } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
    ...(student.trim() ? { student: student.trim() } : {}),
    ...(status ? { status: status as 'CURRENT' | 'OVERDUE' } : {}),
    page,
    pageSize: 25,
  }), [branchId, fromDate, toDate, page, status, student]);
  const arrearsQuery = useQuery({
    queryKey: ['finance-arrears', filters],
    queryFn: () => fetchArrears(filters),
    placeholderData: keepPreviousData,
  });
  const report = arrearsQuery.data;

  const exportRows = async () => {
    setExporting(true);
    setExportError('');
    try {
      const baseFilters = { ...filters, page: 1, pageSize: 100 };
      const firstPage = await fetchArrears(baseFilters);
      const items = [...firstPage.items];
      for (let currentPage = 2; currentPage <= firstPage.meta.totalPages; currentPage += 1) {
        const next = await fetchArrears({ ...baseFilters, page: currentPage });
        items.push(...next.items);
      }
      const { default: ExcelJS } = await import('exceljs');
      const rows = items.map((item) => ({
        invoiceNumber: item.invoiceNumber,
        studentCode: item.student.studentCode,
        studentName: item.student.fullName,
        classCode: item.class?.classCode ?? '',
        dueDate: item.dueDate,
        status: item.status === 'OVERDUE' ? 'Quá hạn' : 'Trong hạn',
        amountDue: item.amountDue,
      }));
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cong no');
      worksheet.columns = [
        { header: 'Mã hóa đơn', key: 'invoiceNumber', width: 30 },
        { header: 'Mã học viên', key: 'studentCode', width: 18 },
        { header: 'Học viên', key: 'studentName', width: 28 },
        { header: 'Lớp', key: 'classCode', width: 18 },
        { header: 'Ngày đến hạn', key: 'dueDate', width: 16 },
        { header: 'Trạng thái', key: 'status', width: 16 },
        { header: 'Còn nợ (VND)', key: 'amountDue', width: 18 },
      ];
      worksheet.addRows(rows);
      const workbookBuffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([workbookBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `cong-no-${localDateString()}.xlsx`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setExportError(getErrorText(error, 'Không xuất được toàn bộ kết quả công nợ.'));
    } finally {
      setExporting(false);
    }
  };

  const resetPage = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Tổng nợ theo bộ lọc" value={arrearsQuery.isLoading ? 'Đang tải...' : arrearsQuery.isError ? '—' : formatVND(report?.totals.totalDebt ?? 0)} accent="gold" />
        <SummaryCard label="Học viên còn nợ" value={arrearsQuery.isLoading ? 'Đang tải...' : arrearsQuery.isError ? '—' : String(report?.totals.studentCount ?? 0)} accent="midnight" />
        <SummaryCard label="Tổng quá hạn" value={arrearsQuery.isLoading ? 'Đang tải...' : arrearsQuery.isError ? '—' : formatVND(report?.totals.overdueTotal ?? 0)} accent="error" />
      </div>

      <Card className="p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Select label="Chi nhánh" value={branchId} onChange={(event) => resetPage(setBranchId, event.target.value)}>
            <option value="">Tất cả chi nhánh được cấp</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
          </Select>
          <Input label="Từ ngày đến hạn" type="date" value={fromDate} onChange={(event) => resetPage(setFromDate, event.target.value)} />
          <Input label="Đến ngày đến hạn" type="date" value={toDate} onChange={(event) => resetPage(setToDate, event.target.value)} />
          <Input label="Học viên / mã học viên" value={student} onChange={(event) => resetPage(setStudent, event.target.value)} placeholder="Tên hoặc mã học viên" />
          <Select label="Tình trạng công nợ" value={status} onChange={(event) => resetPage(setStatus, event.target.value)}>
            <option value="">Tất cả</option>
            <option value="CURRENT">Trong hạn</option>
            <option value="OVERDUE">Quá hạn</option>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-midnight/45">Tổng tiền và số học viên áp dụng cho toàn bộ kết quả đã lọc, không chỉ trang hiện tại.</p>
          <Button type="button" variant="secondary" disabled={exporting || (report?.meta.totalItems ?? 0) === 0} onClick={() => void exportRows()}>
            <FileSpreadsheet size={16} /> {exporting ? 'Đang xuất...' : 'Xuất Excel toàn bộ kết quả'}
          </Button>
        </div>
        {exportError && <InlineError message={exportError} onRetry={() => void exportRows()} />}
      </Card>

      <Card className="overflow-hidden p-0 shadow-sm">
        {arrearsQuery.isLoading ? <div className="p-10 text-center text-sm text-midnight/50">Đang tải báo cáo công nợ...</div> : arrearsQuery.isError ? (
          <div className="p-5"><InlineError message={getErrorText(arrearsQuery.error, 'Không tải được báo cáo công nợ.')} onRetry={() => void arrearsQuery.refetch()} /></div>
        ) : !report || report.items.length === 0 ? <div className="p-10 text-center text-sm text-midnight/50">Không có hóa đơn còn nợ khớp bộ lọc.</div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead><tr className="bg-midnight/5 text-xs uppercase text-midnight/50"><th className="px-5 py-3">Học viên</th><th>Hóa đơn</th><th>Lớp</th><th>Đến hạn</th><th>Trạng thái</th><th className="px-5 text-right">Còn nợ</th></tr></thead>
                <tbody className="divide-y divide-midnight/5">
                  {report.items.map((item) => (
                    <tr key={item.invoiceId}>
                      <td className="px-5 py-3"><span className="block font-medium">{item.student.fullName}</span><span className="text-xs text-midnight/45">{item.student.studentCode}</span></td>
                      <td>#{item.invoiceNumber}</td>
                      <td>{item.class?.classCode ?? '—'}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td><StatusPill status={item.status} overdue={item.status === 'OVERDUE'} /></td>
                      <td className="px-5 text-right font-semibold">{formatVND(item.amountDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-midnight/10 px-5 py-4 text-sm">
              <span className="text-midnight/55">{report.meta.totalItems} hóa đơn · Trang {report.meta.page} / {Math.max(1, report.meta.totalPages)}</span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="!h-9 !px-4" disabled={page <= 1 || arrearsQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</Button>
                <Button type="button" variant="secondary" className="!h-9 !px-4" disabled={page >= report.meta.totalPages || arrearsQuery.isFetching} onClick={() => setPage((current) => current + 1)}>Sau</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-error" role="alert">
    <span>{message}</span>
    <Button type="button" variant="ghost" className="!h-8 !px-2 text-error" onClick={onRetry}><RefreshCw size={14} /> Thử lại</Button>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-midnight/45">{label}</dt><dd className="mt-1 font-medium text-midnight">{value}</dd></div>;
}

function StatusPill({ status, overdue }: { status: string; overdue: boolean }) {
  const label = overdue || status === 'OVERDUE' ? 'Quá hạn' : status === 'COMPLETED' ? 'Đã thanh toán' : status === 'PARTIAL' ? 'Thanh toán một phần' : status === 'CURRENT' ? 'Trong hạn' : 'Chưa thanh toán';
  const colors = overdue || status === 'OVERDUE' ? 'bg-error/10 text-error' : status === 'COMPLETED' ? 'bg-success/10 text-success' : 'bg-warning/15 text-midnight';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colors}`}>{label}</span>;
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: 'gold' | 'midnight' | 'error' }) {
  const tone = accent === 'gold' ? 'border-gold' : accent === 'error' ? 'border-error' : 'border-midnight';
  return <Card className={`border-l-4 ${tone} p-4 shadow-sm`}>
    <p className="font-label text-xs uppercase tracking-wider text-midnight/45">{label}</p>
    <p className="mt-2 font-headline text-2xl text-midnight">{value}</p>
  </Card>;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split('-').map(Number);
  return Number.isFinite(year) ? new Date(year, month - 1, day).toLocaleDateString('vi-VN') : value;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN');
}