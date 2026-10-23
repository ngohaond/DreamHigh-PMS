import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, RefreshCw } from 'lucide-react';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input } from '../../design-system/components/ui/Input';
import { fetchTeachingHours } from '../../services/schedulingApi';
import type { TeachingHoursRow } from '../../types/scheduling';
import {
  addDaysYmd,
  csvCell,
  defaultReportRange,
  downloadCsv,
  formatYmdVi,
  todayYmd,
} from '../../utils/scheduling';

/**
 * Báo cáo giờ dạy — `GET /reports/teaching-hours`.
 * Backend chỉ tính các buổi đã hoàn tất (endTime <= now) và chưa bị huỷ.
 */
const TeachingHoursPage: React.FC = () => {
  const initialRange = useMemo(() => defaultReportRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['teaching-hours', from, to],
    queryFn: () => fetchTeachingHours(from, to),
    enabled: Boolean(from) && Boolean(to) && from < to,
  });

  const rows: TeachingHoursRow[] = data?.items ?? [];
  const totalMinutes = data?.meta.totalMinutes ?? 0;
  const totalHours = data?.meta.totalHours ?? 0;
  const isRangeInvalid = !from || !to || from >= to;

  const exportCsv = () => {
    const header = ['Giáo viên', 'Số buổi dạy', 'Tổng phút', 'Tổng giờ'];
    const body = rows.map((r) => [r.teacherName, r.sessionCount, r.totalMinutes, r.totalHours]);
    const total = ['TỔNG CỘNG', '', totalMinutes, totalHours];
    const csv = [header, ...body, total]
      .map((line) => line.map((cell) => csvCell(cell)).join(','))
      .join('\r\n');
    downloadCsv(`bao-cao-gio-day-${from}_${to}.csv`, csv);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Báo cáo giờ dạy"
        breadcrumb={[
          { label: 'Báo cáo', href: '#' },
          { label: 'Giờ dạy' },
        ]}
        action={
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={rows.length === 0}
            onClick={exportCsv}
          >
            <Download size={15} strokeWidth={2} aria-hidden /> Xuất CSV
          </Button>
        }
      />

      <div className="flex animate-fade-in flex-col gap-6 pb-10">
        <Card className="flex flex-col gap-4 p-6 shadow-md lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:w-auto">
            <Input type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const today = todayYmd();
                setFrom(addDaysYmd(today, -7));
                setTo(addDaysYmd(today, 7));
              }}
            >
              2 tuần
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const today = todayYmd();
                setFrom(addDaysYmd(today, -30));
                setTo(addDaysYmd(today, 30));
              }}
            >
              2 tháng
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
              Đang tổng hợp giờ dạy...
            </p>
          </Card>
        ) : isError ? (
          <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center shadow-md">
            <p className="font-headline text-xl italic text-midnight">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Không tải được báo cáo giờ dạy.'}
            </p>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => refetch()}>
              <RefreshCw size={15} strokeWidth={2} aria-hidden /> Thử lại
            </Button>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center shadow-md">
            <BarChart3 size={40} strokeWidth={1.5} className="text-midnight/20" aria-hidden />
            <p className="font-headline text-xl italic text-midnight/60">Chưa có dữ liệu giờ dạy</p>
            <p className="font-body text-xs text-midnight/40">
              Trong khoảng {formatYmdVi(from)} → {formatYmdVi(to)} chưa có buổi dạy nào đã hoàn tất.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card className="p-6 shadow-sm">
                <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">
                  Tổng giờ dạy
                </p>
                <p className="mt-2 font-headline text-4xl italic text-midnight">{totalHours.toFixed(2)}</p>
                <p className="mt-1 font-body text-xs text-midnight/45">giờ</p>
              </Card>
              <Card className="p-6 shadow-sm">
                <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">
                  Tổng phút dạy
                </p>
                <p className="mt-2 font-headline text-4xl italic text-midnight">{totalMinutes}</p>
                <p className="mt-1 font-body text-xs text-midnight/45">phút</p>
              </Card>
              <Card className="p-6 shadow-sm">
                <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">
                  Số giáo viên
                </p>
                <p className="mt-2 font-headline text-4xl italic text-midnight">{rows.length}</p>
                <p className="mt-1 font-body text-xs text-midnight/45">đang phát sinh giờ dạy</p>
              </Card>
            </div>

            <Card className="overflow-hidden p-0 shadow-md">
              <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full table-fixed text-left">
                  <thead>
                    <tr className="border-b border-midnight/10 bg-midnight/5">
                      <th className="px-8 py-5 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Giáo viên
                      </th>
                      <th className="w-36 px-6 py-5 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Số buổi dạy
                      </th>
                      <th className="w-36 px-6 py-5 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Tổng phút
                      </th>
                      <th className="w-36 px-6 py-5 pr-8 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        Tổng giờ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight/5">
                    {rows.map((r) => (
                      <tr key={r.teacherId} className="transition-colors hover:bg-midnight/[0.02]">
                        <td className="px-8 py-5 font-body text-sm font-semibold text-midnight">{r.teacherName}</td>
                        <td className="px-6 py-5 text-center font-body text-sm text-midnight/70">{r.sessionCount}</td>
                        <td className="px-6 py-5 text-right font-body text-sm text-midnight/70">{r.totalMinutes}</td>
                        <td className="px-6 py-5 pr-8 text-right font-body text-sm font-semibold text-gold">
                          {r.totalHours.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-midnight/10 bg-midnight/5">
                      <td className="px-8 py-5 font-label text-[10px] font-semibold uppercase tracking-widest text-midnight">
                        Tổng cộng
                      </td>
                      <td className="px-6 py-5 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/50">
                        —
                      </td>
                      <td className="px-6 py-5 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-midnight">
                        {totalMinutes}
                      </td>
                      <td className="px-6 py-5 pr-8 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                        {totalHours.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <p className="text-center font-body text-[11px] italic text-midnight/40">
              Báo cáo chỉ tính các buổi đã hoàn tất và chưa bị huỷ trong khoảng{' '}
              {formatYmdVi(from)} → {formatYmdVi(to)}
              {data?.meta.timeZone ? ` · múi giờ ${data.meta.timeZone}` : ''}.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default TeachingHoursPage;
