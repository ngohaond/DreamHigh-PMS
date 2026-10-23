import React, { useEffect, useId, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, Select } from '../../design-system/components/ui/Input';
import {
  createClass,
  createClassWithSessions,
  updateClass,
} from '../../services/schedulingApi';
import type {
  ApiBranch,
  ApiClass,
  ApiClassStatus,
  ApiCourse,
  ApiRoom,
  ApiUserRef,
} from '../../types/scheduling';
import { CLASS_STATUS_LABEL, WEEKDAY_LABELS, apiErrorMessage, todayYmd } from '../../utils/scheduling';

export interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lớp đang sửa — null nghĩa là tạo mới. */
  initialData: ApiClass | null;
  /** Danh sách khóa học để chọn. */
  courses: ApiCourse[];
  /** Danh sách chi nhánh để chọn. */
  branches: ApiBranch[];
  /** Danh sách giáo viên để chọn. */
  teachers: ApiUserRef[];
  /** Danh sách phòng để chọn khi tạo kèm lịch. */
  rooms: ApiRoom[];
  /** Gọi sau khi lưu thành công. */
  onSuccess: (message: string) => void;
  /** Báo lỗi ra ngoài (toast). */
  onError: (message: string) => void;
}

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

interface ClassForm {
  classCode: string;
  courseId: string;
  branchId: string;
  teacherId: string;
  maxStudents: string;
  startDate: string;
  endDate: string;
  status: ApiClassStatus;
}

function buildInitial(initialData: ApiClass | null, courses: ApiCourse[], branches: ApiBranch[]): ClassForm {
  if (initialData) {
    return {
      classCode: initialData.classCode,
      courseId: String(initialData.courseId ?? ''),
      branchId: String(initialData.branchId ?? ''),
      teacherId: String(initialData.teacherId ?? ''),
      maxStudents: String(initialData.maxStudents ?? 15),
      startDate: initialData.startDate ? initialData.startDate.slice(0, 10) : todayYmd(),
      endDate: initialData.endDate ? initialData.endDate.slice(0, 10) : '',
      status: initialData.status ?? 'PLANNED',
    };
  }
  return {
    classCode: '',
    courseId: courses.length > 0 ? String(courses[0].id) : '',
    branchId: branches.length > 0 ? String(branches[0].id) : '',
    teacherId: '',
    maxStudents: '15',
    startDate: todayYmd(),
    endDate: '',
    status: 'PLANNED',
  };
}

/**
 * Modal tạo / cập nhật lớp học — nối với `POST /classes` và `PATCH /classes/:id`.
 *
 * Bước 1: thông tin lớp (khóa học, chi nhánh, giáo viên, sĩ số, ngày).
 * Bước 2 (chỉ khi tạo mới): lịch lặp. Nếu người dùng điền lịch thì dùng
 * `POST /classes/with-sessions` (tạo lớp + sinh buổi học trong 1 transaction),
 * nếu bỏ trống thì dùng `POST /classes` (tạo lớp trước, sinh lịch sau ở tab điều phối).
 */
const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  initialData,
  courses,
  branches,
  teachers,
  rooms,
  onSuccess,
  onError,
}) => {
  const titleId = useId();
  const isEdit = Boolean(initialData);
  const [step, setStep] = useState<'class' | 'schedule'>('class');
  const [formData, setFormData] = useState<ClassForm>(() => buildInitial(initialData, courses, branches));

  // Lịch lặp (chỉ dùng ở bước 2 khi tạo mới).
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:30');
  const [roomId, setRoomId] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [withSchedule, setWithSchedule] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep('class');
    setFormData(buildInitial(initialData, courses, branches));
    setWeekdays([1, 3, 5]);
    setStartTime('18:00');
    setEndTime('19:30');
    setRoomId('');
    setScheduleEndDate('');
    setWithSchedule(false);
  }, [initialData, isOpen, courses, branches]);

  const merge = (p: Partial<ClassForm>) => setFormData((prev) => ({ ...prev, ...p }));

  const selectedCourse = useMemo(
    () => courses.find((c) => String(c.id) === formData.courseId) ?? null,
    [courses, formData.courseId],
  );

  const branchRooms = useMemo(
    () => rooms.filter((r) => r.branchId === Number(formData.branchId)),
    [rooms, formData.branchId],
  );

  const selectedRoom = branchRooms.find((r) => String(r.id) === roomId) ?? null;
  const maxStudents = Number(formData.maxStudents) || 0;
  const capacityWarning =
    selectedRoom && selectedRoom.capacity < maxStudents
      ? `Phòng ${selectedRoom.name ?? selectedRoom.roomCode} chỉ chứa ${selectedRoom.capacity} chỗ, lớp đang nhận tối đa ${maxStudents} học viên.`
      : null;

  const branchTeachers = useMemo(() => {
    const branchId = Number(formData.branchId);
    if (!branchId) return teachers;
    const scoped = teachers.filter((t) => !t.branchIds?.length || t.branchIds.includes(branchId));
    return scoped.length > 0 ? scoped : teachers;
  }, [teachers, formData.branchId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        classCode: formData.classCode.trim().toUpperCase(),
        courseId: Number(formData.courseId),
        branchId: Number(formData.branchId),
        teacherId: Number(formData.teacherId),
        maxStudents,
        startDate: formData.startDate,
        ...(formData.endDate ? { endDate: formData.endDate } : {}),
      };

      if (isEdit && initialData) {
        await updateClass(initialData.id, {
          courseId: payload.courseId,
          branchId: payload.branchId,
          teacherId: payload.teacherId,
          maxStudents: payload.maxStudents,
          startDate: payload.startDate,
          endDate: formData.endDate || null,
          status: formData.status,
        });
        return { message: `Đã cập nhật lớp ${payload.classCode}.` };
      }

      if (withSchedule) {
        if (!roomId) throw new Error('Vui lòng chọn phòng học hoặc bỏ chọn "Tạo kèm lịch học".');
        const result = await createClassWithSessions({
          classCode: payload.classCode,
          courseId: payload.courseId,
          branchId: payload.branchId,
          teacherId: payload.teacherId,
          roomId: Number(roomId),
          maxStudents: payload.maxStudents,
          weekdays: [...weekdays].sort((a, b) => a - b),
          startDate: formData.startDate,
          endDate: scheduleEndDate || undefined,
          startTime,
          endTime,
        });
        return {
          message: `Đã tạo lớp ${result.classCode} kèm ${result.total} buổi học.`,
        };
      }

      await createClass(payload);
      return { message: `Đã tạo lớp ${payload.classCode}.` };
    },
    onSuccess: (result) => {
      onSuccess(result.message);
      onClose();
    },
    onError: (e: unknown) => {
      onError(apiErrorMessage(e, 'Không lưu được lớp học.'));
    },
  });

  if (!isOpen) return null;

  const canGoToSchedule =
    formData.classCode.trim().length >= 2 &&
    Number(formData.courseId) > 0 &&
    Number(formData.branchId) > 0 &&
    Number(formData.teacherId) > 0 &&
    maxStudents > 0 &&
    Boolean(formData.startDate);

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  return (
    <div
      className="custom-scrollbar fixed inset-0 z-[100] flex items-center justify-center bg-midnight/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-midnight/10 bg-midnight px-8 py-6">
          <div>
            <h2 id={titleId} className="font-label text-lg font-semibold uppercase tracking-tight text-white">
              {isEdit ? 'Cập nhật lớp học' : 'Mở lớp học mới'}
            </h2>
            <p className="mt-1 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
              {isEdit ? 'Bước 1 / 1 — thông tin lớp' : step === 'class' ? 'Bước 1 / 2 — thông tin lớp' : 'Bước 2 / 2 — lịch học'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Đóng"
          >
            <X size={24} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="custom-scrollbar max-h-[min(65vh,520px)] space-y-6 overflow-y-auto p-8">
            {step === 'class' && (
              <>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Select
                      label="Khóa học nguồn (bắt buộc)"
                      required
                      value={formData.courseId}
                      onChange={(e) => merge({ courseId: e.target.value })}
                    >
                      <option value="">— Chọn khóa học —</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Input
                      label="Mã lớp"
                      required
                      className="font-mono text-gold"
                      value={formData.classCode}
                      onChange={(e) => merge({ classCode: e.target.value.toUpperCase() })}
                      placeholder="VD: PY-K1-01"
                    />
                  </div>
                  <div>
                    <Select
                      label="Chi nhánh (bắt buộc)"
                      required
                      value={formData.branchId}
                      onChange={(e) => merge({ branchId: e.target.value, teacherId: '' })}
                    >
                      <option value="">— Chọn chi nhánh —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Select
                      label="Giáo viên phụ trách (bắt buộc)"
                      required
                      value={formData.teacherId}
                      onChange={(e) => merge({ teacherId: e.target.value })}
                    >
                      <option value="">— Chọn giáo viên —</option>
                      {branchTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                          {t.email ? ` · ${t.email}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Input
                      type="date"
                      label="Ngày dự kiến bắt đầu"
                      required
                      value={formData.startDate}
                      onChange={(e) => merge({ startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <Input
                      type="date"
                      label="Ngày dự kiến kết thúc (tuỳ chọn)"
                      value={formData.endDate}
                      onChange={(e) => merge({ endDate: e.target.value })}
                    />
                  </div>
                  {isEdit ? (
                    <div className="md:col-span-2">
                      <Select
                        label="Trạng thái vận hành"
                        value={formData.status}
                        onChange={(e) => merge({ status: e.target.value as ApiClassStatus })}
                      >
                        {(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as ApiClassStatus[]).map((s) => (
                          <option key={s} value={s}>
                            {CLASS_STATUS_LABEL[s] ?? s}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}
                  <div>
                    <Input
                      type="number"
                      label="Sĩ số tối đa"
                      min={1}
                      required
                      value={formData.maxStudents}
                      onChange={(e) => merge({ maxStudents: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-gold/20 bg-gold/[0.06] p-6">
                  <p className="mb-2 flex items-center gap-2 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                    <ShieldCheck size={14} strokeWidth={2} className="shrink-0" aria-hidden /> Khung đào tạo
                  </p>
                  <p className="font-body text-xs font-semibold text-midnight/75">
                    Khóa học: <span className="text-midnight">{selectedCourse?.name || 'Chưa chọn'}</span>
                  </p>
                  <p className="mt-2 font-body text-[10px] italic text-midnight/45">
                    {selectedCourse
                      ? `Chương trình gồm ${selectedCourse.totalSessions} buổi${
                          selectedCourse.durationWeeks ? ` trong ${selectedCourse.durationWeeks} tuần` : ''
                        }.`
                      : 'Chọn khóa học để xem số buổi và thời lượng chương trình.'}
                  </p>
                </div>
              </>
            )}

            {step === 'schedule' && (
              <>
                <label className="flex items-center gap-2 font-body text-[12px] text-midnight/75">
                  <input
                    type="checkbox"
                    checked={withSchedule}
                    onChange={(e) => setWithSchedule(e.target.checked)}
                    className="h-4 w-4 accent-gold"
                  />
                  Tạo lớp kèm lịch học ngay (một giao dịch)
                </label>

                {withSchedule && (
                  <>
                    <fieldset>
                      <legend className="input-label">Ngày trong tuần (bắt buộc)</legend>
                      <div className="flex flex-wrap gap-2">
                        {ISO_WEEKDAYS.map((day) => {
                          const active = weekdays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleWeekday(day)}
                              aria-pressed={active}
                              className={`rounded-xl border px-4 py-2 font-label text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                                active
                                  ? 'border-gold bg-gold text-white'
                                  : 'border-midnight/15 bg-surface text-midnight/50 hover:border-gold/50 hover:text-midnight'
                              }`}
                            >
                              {WEEKDAY_LABELS[day]}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <Input
                        type="date"
                        label="Lịch bắt đầu từ"
                        value={formData.startDate}
                        onChange={(e) => merge({ startDate: e.target.value })}
                      />
                      <Input
                        type="date"
                        label="Lịch kết thúc (tuỳ chọn)"
                        value={scheduleEndDate}
                        onChange={(e) => setScheduleEndDate(e.target.value)}
                      />
                      <Input
                        type="time"
                        label="Giờ bắt đầu"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                      <Input
                        type="time"
                        label="Giờ kết thúc"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                      <div className="md:col-span-2">
                        <Select label="Phòng học (bắt buộc)" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                          <option value="">— Chọn phòng —</option>
                          {branchRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name ?? r.roomCode} ({r.capacity} chỗ)
                              {r.status !== 'AVAILABLE' ? ' — không khả dụng' : ''}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {capacityWarning && (
                      <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 font-body text-[11px] text-warning">
                        <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
                        {capacityWarning}
                      </p>
                    )}

                    <p className="rounded-xl border border-midnight/10 bg-midnight/[0.03] px-4 py-3 font-body text-[11px] text-midnight/60">
                      Lớp sẽ được tạo cùng toàn bộ buổi học theo quy tắc lặp. Nếu bỏ chọn ở trên, lớp vẫn được tạo và
                      bạn có thể sinh lịch chi tiết sau ở màn hình điều phối.
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex gap-4 border-t border-midnight/10 bg-bg p-8">
            {step === 'schedule' ? (
              <Button type="button" variant="ghost" className="flex-1 py-4" onClick={() => setStep('class')}>
                Quay lại
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="flex-1 py-4" onClick={onClose}>
                Huỷ
              </Button>
            )}
            {step === 'class' && !isEdit ? (
              <Button
                type="button"
                className="flex-1 py-4 shadow-md"
                disabled={!canGoToSchedule}
                onClick={() => setStep('schedule')}
              >
                Tiếp tục — lịch học
              </Button>
            ) : (
              <Button type="submit" className="flex-1 py-4 shadow-md" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Đang lưu...' : isEdit ? 'Lưu cập nhật' : 'Mở lớp'}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ClassModal;
