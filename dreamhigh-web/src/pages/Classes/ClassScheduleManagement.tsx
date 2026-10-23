import React, { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CalendarDays,
  Edit2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input } from '../../design-system/components/ui/Input';
import {
  fetchBranches,
  fetchClassDetail,
  fetchClasses,
  fetchCourses,
  fetchRooms,
  fetchTeachers,
} from '../../services/schedulingApi';
import type {
  ApiBranch,
  ApiClass,
  ApiClassDetail,
  ApiCourse,
  ApiRoom,
  ApiUserRef,
  SessionView,
} from '../../types/scheduling';
import type { AdminMessage } from '../../types/adminSystem';
import NotificationPortal from '../Admin/system/NotificationPortal';
import ClassModal from './ClassModal';
import ScheduleGeneratorModal from './ScheduleGeneratorModal';
import SessionActionModal from './SessionActionModal';
import {
  CLASS_STATUS_LABEL,
  ROOM_STATUS_LABEL,
  SESSION_STATUS_LABEL,
  apiErrorMessage,
  formatYmdVi,
  isoWeekday,
  toZonedDateTime,
} from '../../utils/scheduling';

type ClassScheduleTab = 'classes' | 'calendar' | 'rooms';

/** Chuyển session thô trong class detail sang shape chuẩn của backend. */
function toSessionView(detail: ApiClassDetail, raw: NonNullable<ApiClassDetail['sessions']>[number]): SessionView {
  const start = new Date(raw.startTime);
  const end = new Date(raw.endTime);
  const localStart = toZonedDateTime(start);
  const localEnd = toZonedDateTime(end);
  return {
    id: raw.id,
    classId: raw.classId,
    classCode: detail.classCode,
    className: detail.course?.name ?? null,
    roomId: raw.roomId,
    roomName: raw.room?.name ?? raw.room?.roomCode ?? null,
    teacherId: raw.teacherId ?? detail.teacherId,
    teacherName: detail.teacher?.fullName ?? null,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    localDate: localStart.ymd,
    localStartTime: localStart.hhmm,
    localEndTime: localEnd.hhmm,
    status: raw.status,
    topicNote: raw.topicNote,
  };
}

const ClassScheduleManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ClassScheduleTab>('classes');
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ApiClass | null>(null);
  const [activeSession, setActiveSession] = useState<SessionView | null>(null);
  const [scheduleClass, setScheduleClass] = useState<ApiClass | null>(null);

  const showToast = (code: string, text: string, type: AdminMessage['type']) =>
    setMessage({ code, text, type });

  // ---------------------------------------------------------------- danh sách lớp
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: () => fetchClasses({ limit: 100 }),
  });

  const classes = useMemo(() => classesQuery.data?.items ?? [], [classesQuery.data]);

  // Chi tiết từng lớp (kèm sessions) — dùng cho lịch tổng hợp.
  const detailQueries = useQueries({
    queries: classes.map((c) => ({
      queryKey: ['class-detail', c.classCode],
      queryFn: () => fetchClassDetail(c.classCode),
    })),
  });

  const sessions = useMemo<SessionView[]>(() => {
    const out: SessionView[] = [];
    detailQueries.forEach((q) => {
      const detail = q.data;
      if (!detail?.sessions) return;
      detail.sessions.forEach((raw) => out.push(toSessionView(detail, raw)));
    });
    return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [detailQueries]);

  const isDetailLoading = classes.length > 0 && detailQueries.some((q) => q.isLoading);
  const isDetailError = detailQueries.some((q) => q.isError);

  // ---------------------------------------------------------------- danh mục
  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: () => fetchRooms(undefined, true),
  });
  const coursesQuery = useQuery({
    queryKey: ['courses'],
    queryFn: () => fetchCourses(100),
  });
  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => fetchBranches(),
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers-lookup'],
    queryFn: () => fetchTeachers(),
  });

  const rooms: ApiRoom[] = roomsQuery.data ?? [];
  const courses: ApiCourse[] = coursesQuery.data ?? [];
  const branches: ApiBranch[] = branchesQuery.data ?? [];
  const teachers: ApiUserRef[] = teachersQuery.data ?? [];

  const filteredClasses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return classes;
    return classes.filter(
      (c) =>
        c.classCode.toLowerCase().includes(term) || (c.course?.name ?? '').toLowerCase().includes(term),
    );
  }, [classes, searchTerm]);

  const sessionsByClass = useMemo(() => {
    const map: Record<number, SessionView[]> = {};
    sessions.forEach((s) => {
      if (!map[s.classId]) map[s.classId] = [];
      map[s.classId].push(s);
    });
    return map;
  }, [sessions]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['classes'] });
    await queryClient.invalidateQueries({ queryKey: ['class-detail'] });
  };

  const handleClassSuccess = async (text: string) => {
    showToast('CLS-200', text, 'success');
    await refreshAll();
  };

  const handleSessionSuccess = async (text: string) => {
    showToast('SCH-200', text, 'success');
    await refreshAll();
  };

  const handleSessionError = (text: string) => {
    showToast('SCH-422', text, 'error');
  };

  return (
    <AppLayout>
      <NotificationPortal message={message} onClose={() => setMessage(null)} />
      <PageHeader
        title="Vận hành lịch & lớp học"
        breadcrumb={[
          { label: 'Điều hành', href: '#' },
          { label: 'Lớp học', href: '/classes' },
          { label: 'Lịch & phòng' },
        ]}
      />

      <div className="flex animate-fade-in flex-col gap-6 pb-10">
        <Card className="flex flex-col gap-6 p-6 shadow-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-gold p-3 text-midnight shadow-md shadow-gold/25">
              <Calendar size={28} strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h2 className="font-headline text-2xl italic text-midnight">Lịch &amp; lớp</h2>
              <p className="font-body text-sm text-midnight/50">
                Điều phối tài nguyên và biến động giảng dạy
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-midnight/5 p-1.5">
            <TabButton
              active={activeTab === 'classes'}
              label="Danh sách lớp"
              Icon={BookOpen}
              onClick={() => setActiveTab('classes')}
            />
            <TabButton
              active={activeTab === 'calendar'}
              label="Lịch tổng hợp"
              Icon={CalendarDays}
              onClick={() => setActiveTab('calendar')}
            />
            <TabButton
              active={activeTab === 'rooms'}
              label="Phòng học"
              Icon={MapPin}
              onClick={() => setActiveTab('rooms')}
            />
          </div>
        </Card>

        <main className="flex-1">
          {activeTab === 'classes' && (
            <ClassListView
              classes={filteredClasses}
              sessionsMap={sessionsByClass}
              rooms={rooms}
              isLoading={classesQuery.isLoading}
              isError={classesQuery.isError}
              errorMessage={
                classesQuery.isError ? apiErrorMessage(classesQuery.error, 'Không tải được danh sách lớp.') : null
              }
              onRetry={() => classesQuery.refetch()}
              onEditClass={(c) => {
                setEditingClass(c);
                setIsClassModalOpen(true);
              }}
              onOpenSession={setActiveSession}
              onAddClass={() => {
                setEditingClass(null);
                setIsClassModalOpen(true);
              }}
              onCreateSchedule={(c) => setScheduleClass(c)}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              sessions={sessions}
              isLoading={classesQuery.isLoading || isDetailLoading}
              isError={classesQuery.isError || isDetailError}
              errorMessage={
                classesQuery.isError
                  ? apiErrorMessage(classesQuery.error, 'Không tải được lịch tổng hợp.')
                  : isDetailError
                    ? 'Không tải được chi tiết lịch của một số lớp.'
                    : null
              }
              onRetry={refreshAll}
              onOpenSession={setActiveSession}
            />
          )}

          {activeTab === 'rooms' && (
            <RoomListView
              rooms={rooms}
              sessions={sessions}
              isLoading={roomsQuery.isLoading}
              isError={roomsQuery.isError}
              errorMessage={roomsQuery.isError ? apiErrorMessage(roomsQuery.error, 'Không tải được danh sách phòng.') : null}
              onRetry={() => roomsQuery.refetch()}
            />
          )}
        </main>

        <ClassModal
          key={`${isClassModalOpen ? 'open' : 'closed'}-${editingClass?.id ?? 'new'}`}
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setEditingClass(null);
          }}
          initialData={editingClass}
          courses={courses}
          branches={branches}
          teachers={teachers}
          rooms={rooms}
          onSuccess={handleClassSuccess}
          onError={(text) => showToast('CLS-400', text, 'error')}
        />

        {scheduleClass && (
          <ScheduleGeneratorModal
            isOpen
            onClose={() => setScheduleClass(null)}
            trainingClass={scheduleClass}
            rooms={rooms}
            onSuccess={(text) => {
              showToast('SCH-201', text, 'success');
              void refreshAll();
            }}
            onError={(text) => showToast('SCH-422', text, 'error')}
          />
        )}

        {activeSession && (
          <SessionActionModal
            key={activeSession.id}
            isOpen
            onClose={() => setActiveSession(null)}
            session={activeSession}
            rooms={rooms}
            teachers={teachers}
            className={activeSession.className ?? activeSession.classCode ?? ''}
            onSuccess={handleSessionSuccess}
            onError={handleSessionError}
          />
        )}
      </div>
    </AppLayout>
  );
};

const TabButton: React.FC<{
  active: boolean;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
}> = ({ active, label, Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 font-label text-[10px] font-semibold uppercase tracking-widest transition-all ${
      active ? 'bg-surface text-gold shadow-sm' : 'text-midnight/45 hover:text-midnight/70'
    }`}
  >
    <Icon size={14} strokeWidth={2} aria-hidden />
    {label}
  </button>
);

/** Trạng thái lỗi dùng chung cho các tab. */
const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center shadow-md">
    <AlertCircle size={40} strokeWidth={1.5} className="text-error" aria-hidden />
    <p className="font-headline text-xl italic text-midnight">{message}</p>
    <Button type="button" variant="secondary" className="gap-2" onClick={onRetry}>
      <RefreshCw size={15} strokeWidth={2} aria-hidden /> Thử lại
    </Button>
  </Card>
);

const LoadingState: React.FC<{ label?: string }> = ({ label = 'Đang tải dữ liệu...' }) => (
  <Card className="flex items-center justify-center gap-3 p-12 text-center shadow-md">
    <RefreshCw size={20} strokeWidth={2} className="animate-spin text-gold" aria-hidden />
    <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/45">{label}</p>
  </Card>
);

const ClassListView: React.FC<{
  classes: ApiClass[];
  sessionsMap: Record<number, SessionView[]>;
  rooms: ApiRoom[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onEditClass: (c: ApiClass) => void;
  onOpenSession: (s: SessionView) => void;
  onAddClass: () => void;
  onCreateSchedule: (c: ApiClass) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
}> = ({
  classes,
  sessionsMap,
  rooms,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onEditClass,
  onOpenSession,
  onAddClass,
  onCreateSchedule,
  searchTerm,
  setSearchTerm,
}) => {
  if (isLoading) return <LoadingState label="Đang tải danh sách lớp..." />;
  if (isError && errorMessage) return <ErrorState message={errorMessage} onRetry={onRetry} />;

  return (
    <Card className="flex flex-col overflow-hidden p-0 shadow-md">
      <div className="flex flex-col items-center justify-between gap-4 border-b border-midnight/10 p-8 md:flex-row">
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-midnight/40">
            <Search size={16} strokeWidth={2} aria-hidden />
          </span>
          <Input
            className="!pl-10"
            placeholder="Tìm lớp học…"
            aria-label="Tìm lớp học theo mã hoặc tên khóa học"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button type="button" className="gap-2 text-xs" onClick={onAddClass}>
          <Plus size={16} strokeWidth={2} aria-hidden /> Mở lớp mới
        </Button>
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <BookOpen size={40} strokeWidth={1.5} className="text-midnight/20" aria-hidden />
          <p className="font-headline text-xl italic text-midnight/60">
            {searchTerm ? 'Không tìm thấy lớp nào phù hợp' : 'Chưa có lớp học nào'}
          </p>
          <p className="font-body text-xs text-midnight/40">
            {searchTerm ? 'Thử một từ khoá khác.' : 'Bấm “Mở lớp mới” để tạo lớp đầu tiên.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-midnight/10 bg-midnight/5">
                <th className="w-40 px-8 py-5 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Mã lớp
                </th>
                <th className="w-60 px-6 py-5 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Lớp học
                </th>
                <th className="w-24 px-6 py-5 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Sĩ số
                </th>
                <th className="px-6 py-5 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Lịch &amp; phòng (bấm để điều phối)
                </th>
                <th className="w-32 px-6 py-5 pr-8 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight/5">
              {classes.map((cls) => (
                <tr key={cls.id} className="group align-top transition-colors hover:bg-midnight/[0.02]">
                  <td className="px-8 py-7 font-mono text-xs font-semibold text-gold">{cls.classCode}</td>
                  <td className="px-6 py-7">
                    <p className="line-clamp-1 font-body text-sm font-semibold text-midnight">
                      {cls.course?.name ?? '—'}
                    </p>
                    <span
                      className={`mt-2 inline-block rounded border px-2 py-0.5 font-label text-[8px] font-semibold uppercase ${
                        cls.status === 'ACTIVE'
                          ? 'border-success/25 bg-success-bg text-success'
                          : cls.status === 'CANCELLED'
                            ? 'border-error/25 bg-error-bg text-error'
                            : 'border-warning/25 bg-warning-bg text-warning'
                      }`}
                    >
                      {CLASS_STATUS_LABEL[cls.status] ?? cls.status}
                    </span>
                    <p className="mt-2 font-label text-[9px] uppercase tracking-tighter text-midnight/40">
                      {cls.branch?.name ?? '—'} · {cls.teacher?.fullName ?? 'Chưa phân công GV'}
                    </p>
                  </td>
                  <td className="px-6 py-7 text-center">
                    <p className="font-body text-sm font-semibold text-midnight">{cls.maxStudents}</p>
                    <p className="font-label text-[9px] font-semibold uppercase tracking-tighter text-midnight/40">
                      Học viên
                    </p>
                  </td>
                  <td className="px-6 py-7">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {(sessionsMap[cls.id] ?? []).map((sess) => (
                        <SessionTag
                          key={sess.id}
                          session={sess}
                          room={rooms.find((r) => r.id === sess.roomId)}
                          classCapacity={cls.maxStudents}
                          onClick={() => onOpenSession(sess)}
                        />
                      ))}
                      {(sessionsMap[cls.id] ?? []).length === 0 && (
                        <button
                          type="button"
                          onClick={() => onCreateSchedule(cls)}
                          className="flex w-fit items-center gap-2 rounded-2xl border border-dashed border-gold/35 p-3 font-label text-[10px] font-semibold uppercase text-gold transition-colors hover:bg-gold/10"
                        >
                          <Plus size={14} strokeWidth={2} aria-hidden /> Tạo lịch chi tiết
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-7 pr-8 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onCreateSchedule(cls)}
                        className="rounded-xl p-2.5 text-midnight/40 opacity-0 transition-all hover:bg-gold/10 hover:text-gold group-hover:opacity-100"
                        title="Tạo lịch chi tiết"
                      >
                        <CalendarDays size={20} strokeWidth={2} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditClass(cls)}
                        className="rounded-xl p-2.5 text-midnight/40 opacity-0 transition-all hover:bg-gold/10 hover:text-gold group-hover:opacity-100"
                        title="Sửa lớp"
                      >
                        <Edit2 size={20} strokeWidth={2} aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

const SessionTag: React.FC<{
  session: SessionView;
  room: ApiRoom | undefined;
  classCapacity: number;
  onClick: () => void;
}> = ({ session, room, classCapacity, onClick }) => {
  const isMissingRoom = !room;
  const isOverCapacity = Boolean(room && room.capacity > 0 && room.capacity < classCapacity);
  const isCancelled = session.status === 'CANCELLED';

  let box = 'border-midnight/15 bg-surface hover:border-gold/40';
  let roomLabel = room?.name ?? room?.roomCode ?? 'Chưa gán phòng';
  let alertEl: React.ReactNode = null;

  if (isCancelled) {
    box = 'border-error/25 bg-error-bg text-error';
    alertEl = <AlertCircle size={12} strokeWidth={2} className="shrink-0" aria-hidden />;
    roomLabel = 'Đã huỷ';
  } else if (isMissingRoom) {
    box = 'animate-pulse border-error/40 bg-error-bg text-error';
    alertEl = <AlertCircle size={12} strokeWidth={2} className="shrink-0" aria-hidden />;
    roomLabel = 'Chưa gán phòng';
  } else if (isOverCapacity) {
    box = 'border-warning/40 bg-warning-bg text-warning';
    alertEl = <AlertTriangle size={12} strokeWidth={2} className="shrink-0" aria-hidden />;
    roomLabel = `${room!.name ?? room!.roomCode} (quá tải)`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left shadow-sm transition-all ${box}`}
    >
      <div className="flex flex-col">
        <span className="font-label text-[10px] font-semibold uppercase tracking-tight text-midnight">
          {formatYmdVi(session.localDate)}
        </span>
        <span className="text-[9px] font-semibold uppercase text-midnight/45">
          {session.localStartTime} – {session.localEndTime}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="flex items-center gap-1 font-label text-[10px] font-semibold text-midnight">
          {alertEl} {roomLabel}
        </span>
        {room && !isCancelled ? (
          <span className="text-[8px] font-semibold uppercase tracking-tighter text-midnight/40">
            Sức chứa: {room.capacity}
          </span>
        ) : null}
      </div>
    </button>
  );
};

const CalendarView: React.FC<{
  sessions: SessionView[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onOpenSession: (s: SessionView) => void;
}> = ({ sessions, isLoading, isError, errorMessage, onRetry, onOpenSession }) => {
  const byCol = useMemo(() => {
    const cols: SessionView[][] = [[], [], [], [], [], [], []];
    sessions.forEach((s) => {
      const col = isoWeekday(s.localDate) - 1;
      if (col >= 0 && col < 7) cols[col].push(s);
    });
    cols.forEach((list) => list.sort((a, b) => a.localStartTime.localeCompare(b.localStartTime)));
    return cols;
  }, [sessions]);

  if (isLoading) return <LoadingState label="Đang tải lịch tổng hợp..." />;
  if (isError && errorMessage) return <ErrorState message={errorMessage} onRetry={onRetry} />;

  const headers = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  return (
    <Card className="overflow-hidden p-0 shadow-md animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-midnight px-8 py-6 text-white">
        <h3 className="font-label text-lg font-semibold uppercase tracking-tight">Lịch điều phối tổng hợp</h3>
        <span className="font-label text-[10px] uppercase tracking-widest text-white/50">
          {sessions.length} buổi · tuần hiện tại
        </span>
      </div>
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 p-16 text-center">
          <CalendarDays size={40} strokeWidth={1.5} className="text-midnight/20" aria-hidden />
          <p className="font-headline text-xl italic text-midnight/60">Chưa có buổi học nào</p>
          <p className="font-body text-xs text-midnight/40">
            Tạo lịch chi tiết cho một lớp ở tab “Danh sách lớp” để lịch hiển thị ở đây.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 p-4 md:gap-4">
          {headers.map((d) => (
            <div
              key={d}
              className="mb-2 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40"
            >
              {d}
            </div>
          ))}
          {byCol.map((colSessions, i) => (
            <div
              key={i}
              className="min-h-[320px] space-y-3 rounded-2xl border border-midnight/10 bg-midnight/[0.03] p-2 md:min-h-[480px]"
            >
              {colSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSession(s)}
                  className={`w-full rounded-2xl border p-4 text-left shadow-sm transition-all hover:border-gold hover:shadow-md ${
                    s.status === 'CANCELLED'
                      ? 'border-error/30 bg-error-bg opacity-70'
                      : 'border-midnight/15 bg-surface'
                  }`}
                >
                  <p className="mb-1 font-label text-[9px] font-semibold uppercase text-gold">
                    {s.localStartTime} – {s.localEndTime}
                  </p>
                  <p className="mb-3 line-clamp-2 font-body text-xs font-semibold leading-tight text-midnight">
                    {s.className ?? s.classCode}
                  </p>
                  <div className="flex flex-col gap-1.5 border-t border-midnight/10 pt-3">
                    <span className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-tighter text-midnight/45">
                      <UserCheck size={10} strokeWidth={2} className="shrink-0" aria-hidden />{' '}
                      {s.teacherName ?? 'Chưa phân công'}
                    </span>
                    <span className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-tighter text-midnight/45">
                      <MapPin size={10} strokeWidth={2} aria-hidden /> {s.roomName ?? 'N/A'}
                    </span>
                    {s.status !== 'NORMAL' && (
                      <span className="text-[8px] font-semibold uppercase tracking-tighter text-warning">
                        {SESSION_STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const RoomListView: React.FC<{
  rooms: ApiRoom[];
  sessions: SessionView[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}> = ({ rooms, sessions, isLoading, isError, errorMessage, onRetry }) => {
  const usageByRoom = useMemo(() => {
    const map: Record<number, number> = {};
    sessions.forEach((s) => {
      if (s.status === 'CANCELLED') return;
      map[s.roomId] = (map[s.roomId] ?? 0) + 1;
    });
    return map;
  }, [sessions]);

  if (isLoading) return <LoadingState label="Đang tải danh sách phòng học..." />;
  if (isError && errorMessage) return <ErrorState message={errorMessage} onRetry={onRetry} />;

  if (rooms.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center shadow-md">
        <MapPin size={40} strokeWidth={1.5} className="text-midnight/20" aria-hidden />
        <p className="font-headline text-xl italic text-midnight/60">Chưa có phòng học nào</p>
        <p className="font-body text-xs text-midnight/40">
          Thêm phòng học ở mục “Danh mục → Cấu hình phòng học”.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid animate-fade-in grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {rooms.map((room) => (
        <Card key={room.id} className="group relative overflow-hidden p-8 shadow-sm transition-all hover:border-gold/35">
          <div className="pointer-events-none absolute right-0 top-0 p-4 opacity-5 transition-transform duration-700 group-hover:scale-125">
            <MapPin size={64} strokeWidth={1.25} aria-hidden />
          </div>
          <div className="relative mb-6 flex items-start justify-between">
            <div className="rounded-2xl bg-midnight/5 p-4 text-gold shadow-inner transition-colors group-hover:bg-gold group-hover:text-midnight">
              <MapPin size={24} strokeWidth={2} aria-hidden />
            </div>
            <span
              className={`rounded-full border px-3 py-1 font-label text-[9px] font-semibold uppercase ${
                room.status === 'AVAILABLE'
                  ? 'border-success/25 bg-success-bg text-success'
                  : room.status === 'MAINTENANCE'
                    ? 'border-warning/25 bg-warning-bg text-warning'
                    : 'border-error/25 bg-error-bg text-error'
              }`}
            >
              {ROOM_STATUS_LABEL[room.status] ?? room.status}
            </span>
          </div>
          <h3 className="font-headline text-xl italic text-midnight">{room.name ?? room.roomCode}</h3>
          <p className="mt-1 font-body text-xs font-semibold uppercase tracking-widest text-midnight/45">
            Sức chứa: {room.capacity} học sinh
          </p>
          <p className="mt-1 font-body text-[10px] uppercase tracking-wider text-midnight/35">
            Mã phòng: {room.roomCode}
          </p>
          <div className="mt-8 flex flex-wrap gap-2 border-t border-midnight/10 pt-6">
            <span className="rounded bg-midnight/5 px-2 py-1 font-label text-[8px] font-semibold uppercase text-midnight/55">
              {room.branch?.name ?? '—'}
            </span>
            <span className="rounded bg-midnight/5 px-2 py-1 font-label text-[8px] font-semibold uppercase text-midnight/55">
              {usageByRoom[room.id] ?? 0} buổi đã xếp
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ClassScheduleManagement;
