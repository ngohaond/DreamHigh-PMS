import React, { useEffect, useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, Select, TextArea } from '../../design-system/components/ui/Input';
import {
  cancelSession,
  changeSessionRoom,
  changeSessionTeacher,
  rescheduleSession,
} from '../../services/schedulingApi';
import type { ApiRoom, ApiUserRef, ScheduleConflictDetail, SessionView } from '../../types/scheduling';
import {
  CONFLICT_RESOURCE_LABEL,
  SESSION_STATUS_LABEL,
  apiConflictDetail,
  apiErrorMessage,
  formatIsoVi,
} from '../../utils/scheduling';

export interface SessionActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Buổi học cần điều phối. */
  session: SessionView;
  /** Danh sách phòng dùng cho select. */
  rooms: ApiRoom[];
  /** Danh sách giáo viên dùng cho select. */
  teachers: ApiUserRef[];
  /** Tên lớp hiển thị trên header modal. */
  className: string;
  /** Gọi sau khi thay đổi thành công để refetch dữ liệu. */
  onSuccess?: (message: string) => void;
  /** Báo lỗi ra ngoài (toast). */
  onError?: (message: string) => void;
}

type TabKey = 'reschedule' | 'teacher' | 'room' | 'cancel';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'reschedule', label: 'Đổi giờ' },
  { key: 'teacher', label: 'Đổi giáo viên' },
  { key: 'room', label: 'Đổi phòng' },
  { key: 'cancel', label: 'Huỷ buổi' },
];

/**
 * Modal điều phối một buổi học — nối trực tiếp các endpoint
 * `PATCH /sessions/:id/{reschedule,teacher,room,cancel}`.
 * Lỗi 422 SCHEDULE_CONFLICT được hiển thị chi tiết (GV/Phòng, lớp, khung giờ).
 */
const SessionActionModal: React.FC<SessionActionModalProps> = ({
  isOpen,
  onClose,
  session,
  rooms,
  teachers,
  className,
  onSuccess,
  onError,
}) => {
  const titleId = useId();
  const [tab, setTab] = useState<TabKey>('reschedule');
  const [conflict, setConflict] = useState<ScheduleConflictDetail | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [date, setDate] = useState(session.localDate);
  const [startTime, setStartTime] = useState(session.localStartTime);
  const [endTime, setEndTime] = useState(session.localEndTime);
  const [shiftFollowing, setShiftFollowing] = useState(false);
  const [reason, setReason] = useState('');
  const [teacherId, setTeacherId] = useState<string>(session.teacherId ? String(session.teacherId) : '');
  const [roomId, setRoomId] = useState<string>(String(session.roomId));
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab('reschedule');
    setConflict(null);
    setLocalError(null);
    setDate(session.localDate);
    setStartTime(session.localStartTime);
    setEndTime(session.localEndTime);
    setShiftFollowing(false);
    setReason('');
    setTeacherId(session.teacherId ? String(session.teacherId) : '');
    setRoomId(String(session.roomId));
    setConfirmCancel(false);
  }, [isOpen, session]);

  const handleError = (e: unknown, fallback: string) => {
    const detail = apiConflictDetail(e);
    setConflict(detail);
    const msg = apiErrorMessage(e, fallback);
    setLocalError(msg);
    onError?.(msg);
  };

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      const result = await rescheduleSession(session.id, {
        date,
        startTime,
        endTime,
        shiftFollowing,
        reason: reason.trim() || undefined,
      });
      return result;
    },
    onSuccess: (result) => {
      const shifted = result.shiftedCount > 0 ? ` và ${result.shiftedCount} buổi sau` : '';
      onSuccess?.(`Đã dời buổi học${shifted}.`);
      onClose();
    },
    onError: (e: unknown) => handleError(e, 'Không dời được buổi học.'),
  });

  const teacherMutation = useMutation({
    mutationFn: async () => {
      if (!teacherId) throw new Error('Vui lòng chọn giáo viên');
      return changeSessionTeacher(session.id, {
        teacherId: Number(teacherId),
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      onSuccess?.('Đã đổi giáo viên buổi học.');
      onClose();
    },
    onError: (e: unknown) => handleError(e, 'Không đổi được giáo viên.'),
  });

  const roomMutation = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error('Vui lòng chọn phòng học');
      return changeSessionRoom(session.id, {
        roomId: Number(roomId),
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      onSuccess?.('Đã đổi phòng buổi học.');
      onClose();
    },
    onError: (e: unknown) => handleError(e, 'Không đổi được phòng học.'),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const trimmed = reason.trim();
      if (trimmed.length < 3) throw new Error('Lý do huỷ buổi phải có ít nhất 3 ký tự');
      return cancelSession(session.id, trimmed);
    },
    onSuccess: () => {
      onSuccess?.('Đã huỷ buổi học.');
      onClose();
    },
    onError: (e: unknown) => handleError(e, 'Không huỷ được buổi học.'),
  });

  if (!isOpen) return null;

  const isPending =
    rescheduleMutation.isPending ||
    teacherMutation.isPending ||
    roomMutation.isPending ||
    cancelMutation.isPending;

  const ConflictBlock: React.FC = () =>
    conflict ? (
      <div className="rounded-xl border border-error/30 bg-error-bg p-4">
        <p className="flex items-center gap-2 font-label text-[10px] font-semibold uppercase tracking-widest text-error">
          <AlertTriangle size={14} strokeWidth={2} aria-hidden /> Xung đột lịch
        </p>
        <p className="mt-2 font-body text-[12px] font-semibold text-midnight">
          {CONFLICT_RESOURCE_LABEL[conflict.resourceType] ?? conflict.resourceType} {conflict.resourceName} đã bị trùng
          với lớp {conflict.classCode}.
        </p>
        <p className="mt-1 font-body text-[11px] text-midnight/60">
          Buổi đang trùng: {formatIsoVi(conflict.conflictStartTime)} → {formatIsoVi(conflict.conflictEndTime)}
        </p>
        <p className="mt-1 font-body text-[11px] text-midnight/60">
          Khoảng đề xuất: {formatIsoVi(conflict.requestedStartTime)} → {formatIsoVi(conflict.requestedEndTime)}
        </p>
      </div>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-midnight/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-0 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-midnight/10 bg-midnight px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-label text-sm font-semibold uppercase tracking-tight text-white md:text-base">
              Điều phối buổi học
            </h2>
            <p className="mt-1 truncate font-body text-[10px] text-gold">
              {className || session.classCode} · {session.localDate} · {session.localStartTime} – {session.localEndTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/15 hover:text-white"
            aria-label="Đóng"
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-5 flex flex-wrap gap-1.5 rounded-2xl bg-midnight/5 p-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setLocalError(null);
                  setConflict(null);
                }}
                className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 font-label text-[9px] font-semibold uppercase tracking-widest transition-all ${
                  tab === t.key ? 'bg-surface text-gold shadow-sm' : 'text-midnight/45 hover:text-midnight/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {localError && (
            <p className="mb-4 rounded-xl border border-error/30 bg-error-bg px-4 py-3 font-body text-[11px] text-error">
              {localError}
            </p>
          )}
          <div className="mb-4">
            <ConflictBlock />
          </div>

          {tab === 'reschedule' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                rescheduleMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input type="date" label="Ngày" value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input type="time" label="Bắt đầu" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <Input type="time" label="Kết thúc" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 font-body text-[12px] text-midnight/75">
                <input
                  type="checkbox"
                  checked={shiftFollowing}
                  onChange={(e) => setShiftFollowing(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                Dời tiếp các buổi sau của lớp
              </label>
              <TextArea
                label="Lý do (tuỳ chọn)"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: GV báo ốm, đổi sang khung giờ chiều..."
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending}>
                  {rescheduleMutation.isPending ? 'Đang lưu...' : 'Lưu lịch'}
                </Button>
              </div>
            </form>
          )}

          {tab === 'teacher' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                teacherMutation.mutate();
              }}
              className="space-y-4"
            >
              <Select label="Giáo viên" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">— Chọn giáo viên —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </Select>
              <TextArea
                label="Lý do (tuỳ chọn)"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending || !teacherId}>
                  {teacherMutation.isPending ? 'Đang lưu...' : 'Đổi giáo viên'}
                </Button>
              </div>
            </form>
          )}

          {tab === 'room' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                roomMutation.mutate();
              }}
              className="space-y-4"
            >
              <Select label="Phòng học" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">— Chọn phòng —</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name ?? r.roomCode} ({r.capacity} chỗ)
                    {r.status !== 'AVAILABLE' ? ' — không khả dụng' : ''}
                  </option>
                ))}
              </Select>
              <TextArea
                label="Lý do (tuỳ chọn)"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                  Huỷ
                </Button>
                <Button type="submit" className="flex-1" disabled={isPending || !roomId}>
                  {roomMutation.isPending ? 'Đang lưu...' : 'Đổi phòng'}
                </Button>
              </div>
            </form>
          )}

          {tab === 'cancel' && (
            <div className="space-y-4">
              <p className="rounded-xl border border-warning/30 bg-warning-bg px-4 py-3 font-body text-[11px] text-midnight/70">
                Buổi học sẽ được đánh dấu <strong>Đã huỷ</strong> và không còn tính vào giờ dạy. Lý do là bắt buộc
                (tối thiểu 3 ký tự).
              </p>
              <TextArea
                label="Lý do huỷ buổi (bắt buộc)"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Lớp nghỉ do thời tiết..."
              />
              {!confirmCancel ? (
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
                    Huỷ
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1 border-error text-error hover:bg-error hover:text-white"
                    disabled={reason.trim().length < 3}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Huỷ buổi học
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-error/30 bg-error-bg p-4">
                  <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-error">
                    Xác nhận huỷ buổi học
                  </p>
                  <p className="mt-2 font-body text-[12px] text-midnight/80">
                    {session.localDate} · {session.localStartTime} – {session.localEndTime} ·{' '}
                    {session.classCode ?? className}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setConfirmCancel(false)}>
                      Quay lại
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-error hover:brightness-110"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate()}
                    >
                      {cancelMutation.isPending ? 'Đang huỷ...' : 'Xác nhận huỷ'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-center font-label text-[9px] uppercase tracking-widest text-midnight/35">
            Trạng thái: {SESSION_STATUS_LABEL[session.status] ?? session.status}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SessionActionModal;
