import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Save } from 'lucide-react';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, Select, TextArea } from '../../design-system/components/ui/Input';
import { apiClient } from '../../services/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import { studentStatusLabelVi } from '../../utils/crmStudentStatusLabels';

type StudentDetailResponse = {
  id: number;
  studentCode: string;
  fullName: string;
  dob: string;
  status: string;
  statusChangedAt?: string | null;
  phone?: string | null;
  email?: string | null;
  parent?: { fullName?: string; phone?: string };
  classEnrollments?: unknown[];
  allowedTransitions?: string[];
  statusHistory?: Array<{
    id: number;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};

type PlacementTestRecord = {
  id: number;
  listeningScore: number | string;
  readingScore: number | string;
  writingScore: number | string;
  totalScore: number | string;
  testDate: string;
  notes?: string | null;
  program?: { name: string };
  recommendedLevel?: { code: string; name: string; program?: { name: string } } | null;
};

type PlacementTestEnvelope = { data: PlacementTestRecord[] };
type CatalogOption = { id: number; code: string; name: string };

const scoreFields = [
  { key: 'listeningScore', label: 'Listening' },
  { key: 'readingScore', label: 'Reading' },
  { key: 'writingScore', label: 'Writing' },
] as const;

const localDateString = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

function needsSensitiveReason(target: string): boolean {
  return target === 'DROPPED' || target === 'GRADUATED' || target === 'RESERVED';
}

export default function StudentApiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((state) => state.user);
  const numericId = id ? Number.parseInt(id, 10) : NaN;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [placementBranchId, setPlacementBranchId] = useState('');
  const [placementProgramId, setPlacementProgramId] = useState('');
  const [placementDate, setPlacementDate] = useState(localDateString);
  const [placementScores, setPlacementScores] = useState({
    listeningScore: '',
    readingScore: '',
    writingScore: '',
  });

  const { data: student, isLoading, isError, error } = useQuery({
    queryKey: ['crm-student', numericId],
    enabled: Number.isFinite(numericId),
    queryFn: async () => {
      const resp = await apiClient.get<StudentDetailResponse>(`/students/${numericId}`);
      return resp.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ targetStatus, reason: r }: { targetStatus: string; reason?: string }) => {
      await apiClient.patch(`/students/${numericId}/status`, {
        targetStatus,
        reason: r?.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-student', numericId] });
      await queryClient.invalidateQueries({ queryKey: ['crm-students'] });
      setConfirmOpen(false);
      setPendingTarget(null);
      setReason('');
    },
  });

  const branchQuery = useQuery({
    queryKey: ['placement-branches'],
    queryFn: async () => (await apiClient.get<CatalogOption[]>('/categories/branches')).data,
  });
  const programQuery = useQuery({
    queryKey: ['placement-programs'],
    queryFn: async () => (await apiClient.get<CatalogOption[]>('/categories/programs')).data,
  });
  const placementQuery = useQuery({
    queryKey: ['crm-student-placement-tests', numericId],
    enabled: Number.isFinite(numericId),
    queryFn: async () => {
      const response = await apiClient.get<PlacementTestEnvelope>(`/students/${numericId}/placement-tests`);
      return response.data.data;
    },
  });
  const enrollments = Array.isArray(student?.classEnrollments) ? student.classEnrollments : [];
  const userBranchIds = Array.isArray(authUser?.branchIds) ? authUser.branchIds as number[] : [];
  const isAdmin = authUser?.roles?.includes('ADMIN') ?? false;
  const availableBranches = (branchQuery.data ?? []).filter(
    (branch) => isAdmin || userBranchIds.includes(branch.id),
  );
  const programs = programQuery.data ?? [];
  const enrolledBranchIds = (enrollments as Array<{ trainingClass?: { branchId?: number } }>)
    .map((enrollment) => enrollment.trainingClass?.branchId)
    .filter((branchId): branchId is number => branchId !== undefined);
  const defaultBranch = availableBranches.find((branch) => enrolledBranchIds.includes(branch.id)) ?? availableBranches[0];
  const effectiveBranchId = placementBranchId || String(defaultBranch?.id ?? '');
  const effectiveProgramId = placementProgramId || String(programs[0]?.id ?? '');
  const placementMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ data: PlacementTestRecord }>(
        `/students/${numericId}/placement-tests`,
        {
          branchId: Number(effectiveBranchId),
          programId: Number(effectiveProgramId),
          listeningScore: Number(placementScores.listeningScore),
          readingScore: Number(placementScores.readingScore),
          writingScore: Number(placementScores.writingScore),
          testDate: placementDate,
        },
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-student-placement-tests', numericId] });
      setPlacementScores({ listeningScore: '', readingScore: '', writingScore: '' });
    },
  });

  const placementTests = placementQuery.data ?? [];
  const scoresValid = scoreFields.every(({ key }) => {
    const raw = placementScores[key].trim();
    return /^\d+(\.\d{1,2})?$/.test(raw) && Number.isFinite(Number(raw));
  });
  const canSubmitPlacement =
    Boolean(effectiveBranchId && effectiveProgramId && placementDate) && scoresValid && !placementMutation.isPending;

  const allowed = Array.isArray(student?.allowedTransitions) ? student!.allowedTransitions! : [];
  const currentStatus = student?.status ?? '';

  const openConfirm = (target: string) => {
    setPendingTarget(target);
    setReason('');
    setConfirmOpen(true);
  };

  const handleSubmitChange = () => {
    if (!pendingTarget) return;
    if (needsSensitiveReason(pendingTarget) && !reason.trim()) {
      return;
    }
    mutation.mutate({ targetStatus: pendingTarget, reason: reason.trim() || undefined });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Chi tiết học viên"
        breadcrumb={[
          { label: 'CRM', href: '#' },
          { label: 'Học viên', href: '/crm/students' },
          { label: student?.studentCode ?? `#${id}` },
        ]}
        action={
          <Button type="button" variant="secondary" onClick={() => navigate('/crm/students')}>
            Quay lại danh sách
          </Button>
        }
      />

      {!Number.isFinite(numericId) ? (
        <Card className="mt-8 p-8 text-center text-midnight/50">Mã học viên không hợp lệ.</Card>
      ) : isLoading ? (
        <Card className="mt-8 p-12 text-center text-midnight/40">Đang tải hồ sơ...</Card>
      ) : isError ? (
        <Card className="mt-8 p-8 text-center text-red-600">
          {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tải được hồ sơ học viên.'}
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <Card className="p-6 shadow-md">
            <h2 className="mb-4 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Lộ trình — trạng thái
            </h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <span className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Hiện tại</span>
                <span
                  className={`inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                    currentStatus === 'ACTIVE' ? 'bg-success-bg text-success' : 'bg-midnight/5 text-midnight/50'
                  }`}
                >
                  {studentStatusLabelVi(currentStatus)}
                </span>
                {student?.statusChangedAt && (
                  <span className="font-body text-xs text-midnight/45">
                    Cập nhật lần cuối: {new Date(student.statusChangedAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
              <div className="flex min-w-[min(100%,280px)] flex-col gap-2 sm:flex-row sm:items-end">
                <Select
                  label="Chuyển sang"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) openConfirm(v);
                  }}
                  className="min-w-[200px]"
                >
                  <option value="">— Chọn trạng thái —</option>
                  {allowed.map((s) => (
                    <option key={s} value={s}>
                      {studentStatusLabelVi(s)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {allowed.length === 0 && (
              <p className="mt-3 font-body text-sm text-midnight/40">Không còn chuyển trạng thái hợp lệ (ví dụ đã tốt nghiệp).</p>
            )}
            {mutation.isError && (
              <p className="mt-3 font-body text-sm text-red-600">
                {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được trạng thái.'}
              </p>
            )}
          </Card>

          <Card className="p-6 shadow-md">
            <h2 className="mb-4 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Thông tin định danh
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Mã HV</dt>
                <dd className="font-body text-midnight/90">{student?.studentCode}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Họ tên</dt>
                <dd className="font-body text-midnight/90">{student?.fullName}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Ngày sinh</dt>
                <dd className="font-body text-midnight/90">
                  {student?.dob ? new Date(student.dob).toLocaleDateString('vi-VN') : '—'}
                </dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">SĐT học viên</dt>
                <dd className="font-body text-midnight/90">{student?.phone ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Email</dt>
                <dd className="font-body text-midnight/90">{student?.email ?? '—'}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6 shadow-md">
            <h2 className="mb-4 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Phụ huynh / Người liên hệ
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">Họ tên</dt>
                <dd className="font-body text-midnight/90">{student?.parent?.fullName ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-label text-[10px] uppercase tracking-wider text-midnight/40">SĐT</dt>
                <dd className="font-body text-midnight/90">{student?.parent?.phone ?? '—'}</dd>
              </div>
            </dl>
          </Card>

          {student?.statusHistory && student.statusHistory.length > 0 && (
            <Card className="p-6 shadow-md">
              <h2 className="mb-4 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Lịch sử trạng thái
              </h2>
              <ul className="space-y-2">
                {student.statusHistory.map((h) => (
                  <li key={h.id} className="font-body text-sm text-midnight/80">
                    <span className="text-midnight/45">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                    {' — '}
                    {h.fromStatus ? studentStatusLabelVi(h.fromStatus) : '—'} → {studentStatusLabelVi(h.toStatus)}
                    {h.reason ? ` · ${h.reason}` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-6 shadow-md">
            <h2 className="mb-4 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Lớp đã ghi danh
            </h2>
            {enrollments.length === 0 ? (
              <p className="font-body text-sm text-midnight/40">Chưa có lớp nào.</p>
            ) : (
              <ul className="space-y-2">
                {(enrollments as Array<{ id: number; trainingClass?: { name?: string; code?: string }; trainingClassId?: number }>).map(
                  (e) => (
                  <li key={e.id} className="font-body text-sm text-midnight/80">
                    {e.trainingClass?.name ?? e.trainingClass?.code ?? `Lớp #${e.trainingClassId}`}
                  </li>
                  ),
                )}
              </ul>
            )}
          </Card>

          <Card className="p-6 shadow-md">
            <h2 className="mb-4 flex items-center gap-2 border-b border-midnight/10 pb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <ClipboardCheck size={16} aria-hidden /> Placement test
            </h2>
            <form
              className="space-y-4"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                if (canSubmitPlacement) placementMutation.mutate();
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Select label="Chi nhánh" value={effectiveBranchId} onChange={(event) => setPlacementBranchId(event.target.value)} required>
                  <option value="">Chọn chi nhánh</option>
                  {availableBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>
                  ))}
                </Select>
                <Select label="Chương trình" value={effectiveProgramId} onChange={(event) => setPlacementProgramId(event.target.value)} required>
                  <option value="">Chọn chương trình</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </Select>
                <Input label="Ngày thi" type="date" value={placementDate} onChange={(event) => setPlacementDate(event.target.value)} required />
                {scoreFields.map(({ key, label }) => (
                  <Input
                    key={key}
                    label={`${label} (điểm)`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={placementScores[key]}
                    onChange={(event) => setPlacementScores((scores) => ({ ...scores, [key]: event.target.value }))}
                    required
                  />
                ))}
              </div>
              {availableBranches.length === 0 && (
                <p className="font-body text-sm text-warning">Tài khoản chưa được cấp quyền chi nhánh để ghi nhận placement.</p>
              )}
              {placementMutation.isError && (
                <p className="font-body text-sm text-red-600">
                  {(placementMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lưu được kết quả placement.'}
                </p>
              )}
              <Button type="submit" disabled={!canSubmitPlacement || availableBranches.length === 0 || programs.length === 0}>
                <Save size={16} aria-hidden />
                {placementMutation.isPending ? 'Đang lưu...' : 'Lưu và xem gợi ý'}
              </Button>
            </form>

            <div className="mt-6 border-t border-midnight/10 pt-4">
              <h3 className="mb-3 font-label text-xs font-semibold uppercase tracking-wider text-midnight/65">Kết quả đã lưu</h3>
              {placementQuery.isLoading ? (
                <p className="font-body text-sm text-midnight/45">Đang tải lịch sử placement...</p>
              ) : placementQuery.isError ? (
                <p className="font-body text-sm text-red-600">Không tải được lịch sử placement.</p>
              ) : placementTests.length === 0 ? (
                <p className="font-body text-sm text-midnight/45">Chưa có bài kiểm tra xếp lớp.</p>
              ) : (
                <ul className="divide-y divide-midnight/10">
                  {placementTests.map((test) => (
                    <li key={test.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                      <div>
                        <p className="font-body text-sm text-midnight/80">
                          {new Date(test.testDate).toLocaleDateString('vi-VN')} · {test.program?.name ?? test.recommendedLevel?.program?.name ?? 'Chương trình'}
                        </p>
                        <p className="mt-1 font-body text-xs text-midnight/55">
                          L: {test.listeningScore} · R: {test.readingScore} · W: {test.writingScore} · Tổng: {test.totalScore}
                        </p>
                      </div>
                      {test.recommendedLevel ? (
                        <span className="rounded-full bg-gold/15 px-3 py-1 font-label text-xs font-semibold text-midnight">
                          {test.recommendedLevel.code} · {test.recommendedLevel.name}
                        </span>
                      ) : (
                        <span className="font-body text-xs text-midnight/50">Chưa có cấp độ phù hợp theo barem</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {confirmOpen && pendingTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-midnight/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-confirm-title"
        >
          <Card className="w-full max-w-md p-6 shadow-xl">
            <h2 id="status-confirm-title" className="font-label text-lg font-semibold text-midnight">
              Xác nhận đổi trạng thái
            </h2>
            <p className="mt-2 font-body text-sm text-midnight/70">
              {studentStatusLabelVi(currentStatus)} → <strong>{studentStatusLabelVi(pendingTarget)}</strong>
            </p>
            {needsSensitiveReason(pendingTarget) && (
              <div className="mt-4">
                <TextArea
                  label="Lý do (bắt buộc cho bước này)"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do ngắn gọn..."
                />
              </div>
            )}
            {!needsSensitiveReason(pendingTarget) && (
              <div className="mt-4">
                <TextArea
                  label="Ghi chú (tuỳ chọn)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingTarget(null);
                  setReason('');
                }}
              >
                Huỷ
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  mutation.isPending || (needsSensitiveReason(pendingTarget) && !reason.trim())
                }
                onClick={handleSubmitChange}
              >
                {mutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
