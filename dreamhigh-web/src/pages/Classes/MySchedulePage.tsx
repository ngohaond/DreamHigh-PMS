import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, MapPin, RefreshCw, UserCheck } from 'lucide-react';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input } from '../../design-system/components/ui/Input';
import { fetchMySchedule } from '../../services/schedulingApi';
import type { SessionView } from '../../types/scheduling';
import {
  SESSION_STATUS_LABEL,
  WEEKDAY_SHORT,
  addDaysYmd,
  currentWeekRange,
  formatYmdVi,
  isoWeekday,
  todayYmd,
} from '../../utils/scheduling';

/**
 * Lịch cá nhân của giáo viên — `GET /sessions/my-schedule`.
 * Backend tự giới hạn theo user đang đăng nhập (JWT), không nhận teacherId từ client.
 */
const MySchedulePage: React.FC = () => {
  const initialRange = useMemo(() => currentWeekRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['my-schedule', from, to],
    queryFn: () => fetchMySchedule(from, to),
    enabled: Boolean(from) && Boolean(to) && from < to,
  });

  const sessions = useMemo<SessionView[]>(() => data?.items ?? [], [data?.items]);

  const byDate = useMemo(() => {
    const map = new Map<string, SessionView[]>();
    sessions.forEach((s) => {
      const list = map.get(s.localDate) ?? [];
      list.push(s);
      map.set(s.localDate, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [sessions]);

  const shiftWeek = (delta: number) => {
    setFrom(addDaysYmd(from, delta * 7));
    setTo(addDaysYmd(to, delta * 7));
  };

  const isRangeInvalid = !from || !to || from >= to;

  return (
    <AppLayout>
      <PageHeader
        title="Lịch dạy của tôi"
        breadcrumb={[
          { label: 'Đào tạo', href: '#' },
          { label: 'Lớp học', href: '/classes' },
          { label: 'Lịch cá nhân' },
        ]}
      />

      <div className="flex animate-fade-in flex-col gap-6 pb-10">
        <Card className="flex flex-col gap-4 p-6 shadow-md lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-auto">
            <Input
              type="date"
              label="Từ ngày"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" className="gap-2" onClick={() => shiftWeek(-1)}>
              Tuần trước
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const range = currentWeekRange();
                setFrom(range.from);
                setTo(range.to);
              }}
            >
              Tuần này
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => shiftWeek(1)}>
              Tuần sau
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                const today = todayYmd();
                setFrom(addDaysYmd(today, -30));
                setTo(addDaysYmd(today, 30));
              }}
            >
              30 ngày
            </Button>
          </div>
        </Card>

        {isRangeInvalid ? (
          <Card className="p-10 text-center shadow-md">
            <p className="font-headline text-xl italic text-midnight/70">
              Khoảng ngày không hợp lệ — “Từ ngày” phải nhỏ hơn “Đến ngày”.
            </p>
          </Card>
        ) : isLoading ? (
          <Card className="flex items-center justify-center gap-3 p-12 shadow-md">
            <RefreshCw size={20} strokeWidth={2} className="animate-spin text-gold" aria-hidden />
            <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/45">
              Đang tải lịch cá nhân...
            </p>
          </Card>
        ) : isError ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center shadow-md">
            <p className="font-headline text-xl italic text-midnight">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Không tải được lịch cá nhân.'}
            </p>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => refetch()}>
              <RefreshCw size={15} strokeWidth={2} aria-hidden /> Thử lại
            </Button>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center shadow-md">
            <CalendarDays size={40} strokeWidth={1.5} className="text-midnight/20" aria-hidden />
            <p className="font-headline text-xl italic text-midnight/60">Không có buổi dạy nào</p>
            <p className="font-body text-xs text-midnight/40">
              Trong khoảng {formatYmdVi(from)} → {formatYmdVi(to)} bạn chưa có buổi dạy nào được xếp.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {byDate.map(([date, list]) => (
              <Card key={date} className="overflow-hidden p-0 shadow-md">
                <div className="flex items-center gap-3 border-b border-midnight/10 bg-midnight/5 px-6 py-4">
                  <span className="rounded-lg bg-gold px-2.5 py-1 font-label text-[10px] font-semibold uppercase tracking-widest text-white">
                    {WEEKDAY_SHORT[isoWeekday(date)]}
                  </span>
                  <span className="font-headline text-lg italic text-midnight">{formatYmdVi(date)}</span>
                  <span className="ml-auto font-label text-[10px] uppercase tracking-widest text-midnight/40">
                    {list.length} buổi
                  </span>
                </div>
                <ul className="divide-y divide-midnight/5">
                  {list.map((s) => (
                    <li key={s.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Clock size={16} strokeWidth={2} className="shrink-0 text-gold" aria-hidden />
                        <span className="font-body text-sm font-semibold text-midnight">
                          {s.localStartTime} – {s.localEndTime}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-body text-xs font-semibold text-midnight/80">
                          {s.className ?? s.classCode ?? '—'}
                        </span>
                        <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-wider text-midnight/45">
                          <MapPin size={12} strokeWidth={2} aria-hidden /> {s.roomName ?? 'N/A'}
                        </span>
                        {s.status !== 'NORMAL' && (
                          <span className="rounded-full border border-warning/25 bg-warning-bg px-2 py-0.5 font-label text-[9px] font-semibold uppercase text-warning">
                            {SESSION_STATUS_LABEL[s.status] ?? s.status}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}

        {data && sessions.length > 0 && (
          <p className="flex items-center justify-center gap-2 font-label text-[10px] uppercase tracking-widest text-midnight/40">
            <UserCheck size={12} strokeWidth={2} aria-hidden />
            Tổng cộng {sessions.length} buổi dạy
            {data.timeZone ? ` · múi giờ ${data.timeZone}` : ''}
          </p>
        )}
      </div>
    </AppLayout>
  );
};

export default MySchedulePage;
