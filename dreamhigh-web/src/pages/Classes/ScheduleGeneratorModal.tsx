import React, { useEffect, useId, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, Select } from '../../design-system/components/ui/Input';
import {
  generateSessions,
  previewSessions,
} from '../../services/schedulingApi';
import type { ApiClass, ApiRoom, ScheduleConflictDetail, SessionPreview } from '../../types/scheduling';
import {
  CONFLICT_RESOURCE_LABEL,
  WEEKDAY_LABELS,
  apiConflictDetail,
  apiErrorMessage,
  formatIsoVi,
  todayYmd,
} from '../../utils/scheduling';

export interface ScheduleGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Lớp cần sinh thêm buổi học. */
  trainingClass: ApiClass;
  /** Danh sách phòng đã tải sẵn (dùng cho select phòng). */
  rooms: ApiRoom[];
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Modal tạo lịch chi tiết cho một lớp đã tồn tại.
 * Luồng: nhập quy tắc lặp → `POST /classes/:id/sessions/preview` xem trước
 * (kèm cảnh báo xung đột) → bấm "Xác nhận" mới gọi
 * `POST /classes/:id/sessions/generate` để ghi DB.
 */
const ScheduleGeneratorModal: React.FC<ScheduleGeneratorModalProps> = ({
  isOpen,
  onClose,
  trainingClass,
  rooms,
  onSuccess,
  onError,
}) => {
  const titleId = useId();
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [startDate, setStartDate] = useState(todayYmd());
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('19:30');
  const [roomId, setRoomId] = useState<string>('');
  const [sessionCount, setSessionCount] = useState<string>('');
  const [preview, setPreview] = useState<SessionPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ScheduleConflictDetail | null>(null);

  // Phòng mặc định: phòng đầu tiên thuộc chi nhánh của lớp.
  useEffect(() => {
    if (!isOpen) return;
    const candidates = rooms.filter((r) => r.branchId === trainingClass.branchId && r.status === 'AVAILABLE');
    setRoomId((prev) => {
      if (prev && candidates.some((r) => String(r.id) === prev)) return prev;
      return candidates.length > 0 ? String(candidates[0].id) : '';
    });
  }, [isOpen, rooms, trainingClass.branchId]);

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
    setPreview(null);
  };

  const rulePayload = useMemo(
    () => ({
      weekdays: [...weekdays].sort((a, b) => a - b),
      startDate,
      endDate: endDate || undefined,
      startTime,
      endTime,
      sessionCount: sessionCount ? Number(sessionCount) : undefined,
    }),
    [weekdays, startDate, endDate, startTime, endTime, sessionCount],
  );

  const previewMutation = useMutation({
    mutationFn: async () => {
      return previewSessions(trainingClass.id, {
        ...rulePayload,
        roomId: roomId ? Number(roomId) : undefined,
      });
    },
    onSuccess: (data) => {
      setPreview(data);
      setPreviewError(null);
      setConflict(data.conflicts?.[0] ?? null);
    },
    onError: (e: unknown) => {
      setPreview(null);
      setConflict(apiConflictDetail(e));
      setPreviewError(apiErrorMessage(e, 'Không xem trước được lịch.'));
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error('Vui lòng chọn phòng học');
      return generateSessions(trainingClass.id, {
        roomId: Number(roomId),
        ...rulePayload,
      });
    },
    onSuccess: (created) => {
      onSuccess(`Đã tạo ${created} buổi học cho lớp ${trainingClass.classCode}.`);
      onClose();
    },
    onError: (e: unknown) => {
      const detail = apiConflictDetail(e);
      if (detail) setConflict(detail);
      onError(apiErrorMessage(e, 'Không tạo được lịch học.'));
    },
  });

  if (!isOpen) return null;

  const branchRooms = rooms.filter((r) => r.branchId === trainingClass.branchId);
  const selectedRoom = branchRooms.find((r) => String(r.id) === roomId);
  const capacityWarning =
    selectedRoom && selectedRoom.capacity < trainingClass.maxStudents
      ? `Phòng ${selectedRoom.name ?? selectedRoom.roomCode} chỉ chứa ${selectedRoom.capacity} chỗ, lớp đang nhận tối đa ${trainingClass.maxStudents} học viên.`
      : null;

  return (
    <div
      className="custom-scrollbar fixed inset-0 z-[100] flex items-center justify-center bg-midnight/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-midnight/10 bg-midnight px-8 py-6">
          <div>
            <h2 id={titleId} className="font-label text-lg font-semibold uppercase tracking-tight text-white">
              Tạo lịch chi tiết
            </h2>
            <p className="mt-1 font-body text-[11px] text-gold">
              Lớp {trainingClass.classCode} · {trainingClass.course?.name ?? '—'}
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

        <div className="custom-scrollbar max-h-[min(65vh,540px)] space-y-6 overflow-y-auto p-8">
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
              label="Ngày bắt đầu"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreview(null);
              }}
            />
            <Input
              type="date"
              label="Ngày kết thúc (tuỳ chọn)"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreview(null);
              }}
            />
            <Input
              type="time"
              label="Giờ bắt đầu"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setPreview(null);
              }}
            />
            <Input
              type="time"
              label="Giờ kết thúc"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setPreview(null);
              }}
            />
            <Select
              label="Phòng học"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">— Chọn phòng —</option>
              {branchRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.roomCode} ({r.capacity} chỗ){r.status !== 'AVAILABLE' ? ' — không khả dụng' : ''}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              label="Số buổi tối đa (tuỳ chọn)"
              min={1}
              value={sessionCount}
              onChange={(e) => {
                setSessionCount(e.target.value);
                setPreview(null);
              }}
              placeholder="VD: 12"
            />
          </div>

          {capacityWarning && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 font-body text-[11px] text-warning">
              <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
              {capacityWarning}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={previewMutation.isPending || weekdays.length === 0}
              onClick={() => previewMutation.mutate()}
            >
              <CalendarDays size={15} strokeWidth={2} aria-hidden />
              {previewMutation.isPending ? 'Đang xem trước...' : 'Xem trước lịch'}
            </Button>
          </div>

          {previewError && (
            <p className="rounded-xl border border-error/30 bg-error-bg px-4 py-3 font-body text-[11px] text-error">
              {previewError}
            </p>
          )}

          {conflict && (
            <div className="rounded-xl border border-error/30 bg-error-bg p-4">
              <p className="flex items-center gap-2 font-label text-[10px] font-semibold uppercase tracking-widest text-error">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden /> Xung đột lịch
              </p>
              <p className="mt-2 font-body text-[12px] font-semibold text-midnight">
                {CONFLICT_RESOURCE_LABEL[conflict.resourceType] ?? conflict.resourceType} {conflict.resourceName} đã bị
                trùng với lớp {conflict.classCode}.
              </p>
              <p className="mt-1 font-body text-[11px] text-midnight/60">
                Buổi đang trùng: {formatIsoVi(conflict.conflictStartTime)} → {formatIsoVi(conflict.conflictEndTime)}
              </p>
              <p className="mt-1 font-body text-[11px] text-midnight/60">
                Khoảng đề xuất: {formatIsoVi(conflict.requestedStartTime)} → {formatIsoVi(conflict.requestedEndTime)}
              </p>
            </div>
          )}

          {preview && (
            <div className="rounded-xl border border-midnight/10 bg-midnight/[0.03] p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Lịch dự kiến ({preview.total} buổi)
                </p>
                <span className="font-label text-[9px] uppercase tracking-wider text-midnight/40">
                  Múi giờ {preview.timeZone}
                </span>
              </div>
              {preview.total === 0 ? (
                <p className="font-body text-[12px] text-midnight/50">
                  Khoảng ngày chọn không có buổi nào khớp ngày trong tuần.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
                  {preview.sessions.map((s) => (
                    <li
                      key={`${s.localDate}-${s.localStartTime}`}
                      className="flex items-center justify-between rounded-lg border border-midnight/10 bg-surface px-3 py-2"
                    >
                      <span className="font-body text-[11px] font-semibold text-midnight">
                        {WEEKDAY_LABELS[s.weekday]} · {s.localDate}
                      </span>
                      <span className="font-label text-[10px] uppercase tracking-wider text-midnight/50">
                        {s.localStartTime} – {s.localEndTime}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {preview.hasConflict && (
                <p className="mt-3 font-body text-[11px] font-semibold text-error">
                  Lịch dự kiến đang có xung đột — hãy chỉnh phòng hoặc khung giờ trước khi xác nhận.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4 border-t border-midnight/10 bg-bg p-8">
          <Button type="button" variant="ghost" className="flex-1 py-4" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            type="button"
            className="flex-1 py-4 shadow-md"
            disabled={!preview || preview.total === 0 || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? 'Đang tạo...' : 'Xác nhận tạo lịch'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ScheduleGeneratorModal;
