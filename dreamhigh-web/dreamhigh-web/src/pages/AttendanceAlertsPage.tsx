import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { getAttendanceAlerts, acknowledgeAlert, resolveAlert } from '../../services/phaseCApi';
import type { AttendanceAlert } from '../../types/phaseC';

export const AttendanceAlertsPage: React.FC = () => {
  const [filters, setFilters] = useState<{
    riskLevel?: AttendanceAlert['riskLevel'];
    status?: AttendanceAlert['status'];
  }>({});

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-alerts', filters],
    queryFn: () => getAttendanceAlerts(filters),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
    },
  });

  const alerts = data?.alerts || [];

  const riskLevelLabels: Record<AttendanceAlert['riskLevel'], string> = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    CRITICAL: 'Nghiêm trọng',
  };

  const riskLevelColors: Record<AttendanceAlert['riskLevel'], string> = {
    LOW: 'bg-info/10 text-info border-info/20',
    MEDIUM: 'bg-warning/10 text-warning border-warning/20',
    HIGH: 'bg-error/10 text-error border-error/20',
    CRITICAL: 'bg-error text-white border-error',
  };

  const statusLabels: Record<AttendanceAlert['status'], string> = {
    ACTIVE: 'Đang hoạt động',
    ACKNOWLEDGED: 'Đã xác nhận',
    RESOLVED: 'Đã giải quyết',
  };

  const breadcrumb = [
    { label: 'Đào tạo', href: '#' },
    { label: 'Cảnh báo điểm danh' },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-160px)] animate-pulse text-midnight/20 font-label uppercase tracking-widest">
          Đang tải cảnh báo...
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-160px)] text-error">
          <span className="material-symbols-outlined text-6xl mb-4">error_outline</span>
          <p className="font-headline italic text-xl">Không thể tải dữ liệu cảnh báo</p>
          <Button variant="primary" onClick={() => refetch()} className="mt-8 px-12">
            Thử lại
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader breadcrumb={breadcrumb} title="Cảnh báo điểm danh" />

      {/* Filters */}
      <div className="mb-8 flex gap-4 flex-wrap">
        <div className="flex gap-2">
          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40 self-center">
            Mức độ:
          </span>
          <Button
            variant={!filters.riskLevel ? 'primary' : 'ghost'}
            onClick={() => setFilters({ ...filters, riskLevel: undefined })}
            className="text-xs"
          >
            Tất cả
          </Button>
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => (
            <Button
              key={level}
              variant={filters.riskLevel === level ? 'primary' : 'ghost'}
              onClick={() => setFilters({ ...filters, riskLevel: level })}
              className="text-xs"
            >
              {riskLevelLabels[level]}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40 self-center">
            Trạng thái:
          </span>
          <Button
            variant={!filters.status ? 'primary' : 'ghost'}
            onClick={() => setFilters({ ...filters, status: undefined })}
            className="text-xs"
          >
            Tất cả
          </Button>
          {(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? 'primary' : 'ghost'}
              onClick={() => setFilters({ ...filters, status })}
              className="text-xs"
            >
              {statusLabels[status]}
            </Button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-6xl text-midnight/10 mb-4">
            check_circle
          </span>
          <p className="font-headline italic text-xl text-midnight/20 mb-2">
            Không có cảnh báo nào
          </p>
          <p className="text-sm text-midnight/40">
            Tất cả học viên đang có tỷ lệ điểm danh tốt
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const riskColor = riskLevelColors[alert.riskLevel];
            const isActive = alert.status === 'ACTIVE';

            return (
              <Card
                key={alert.id}
                className={`p-6 ${
                  alert.riskLevel === 'CRITICAL' ? 'border-l-4 border-error' : ''
                } hover:shadow-lg transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-headline italic text-xl text-midnight">
                        {alert.studentName}
                      </h3>
                      <span className="font-mono text-xs text-midnight/40">
                        {alert.studentCode}
                      </span>
                      <span
                        className={`font-label uppercase text-[9px] tracking-widest px-3 py-1 rounded-full border ${riskColor}`}
                      >
                        {riskLevelLabels[alert.riskLevel]}
                      </span>
                      {alert.status !== 'ACTIVE' && (
                        <span className="font-label uppercase text-[9px] tracking-widest px-3 py-1 rounded-full border border-midnight/10 text-midnight/40">
                          {statusLabels[alert.status]}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-6 mb-4">
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Lớp học
                        </span>
                        <p className="font-body text-sm font-semibold text-midnight mt-1">
                          {alert.className}
                        </p>
                        <p className="font-mono text-[10px] text-midnight/40">{alert.classCode}</p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Số buổi vắng
                        </span>
                        <p className="font-body text-lg font-semibold text-error mt-1">
                          {alert.absenceCount} / {alert.totalSessions}
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Tỷ lệ vắng
                        </span>
                        <p className="font-body text-lg font-semibold text-error mt-1">
                          {(alert.absenceRate * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Lần vắng gần nhất
                        </span>
                        <p className="font-body text-sm text-midnight mt-1">
                          {alert.lastAbsentDate
                            ? new Date(alert.lastAbsentDate).toLocaleDateString('vi-VN')
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="secondary"
                          className="text-xs"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          Xác nhận đã biết
                        </Button>
                        <Button
                          variant="primary"
                          className="text-xs"
                          onClick={() => resolveMutation.mutate(alert.id)}
                          disabled={resolveMutation.isPending}
                        >
                          Đánh dấu đã giải quyết
                        </Button>
                      </div>
                    )}
                  </div>

                  <span
                    className={`material-symbols-outlined text-4xl ${
                      alert.riskLevel === 'CRITICAL' ? 'text-error' : 'text-warning'
                    }`}
                  >
                    {alert.riskLevel === 'CRITICAL' ? 'dangerous' : 'warning'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};
