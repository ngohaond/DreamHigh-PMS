import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../design-system/components/layout/AppLayout';
import { PageHeader } from '../design-system/components/layout/PageHeader';
import { Button } from '../design-system/components/ui/Button';
import { Card } from '../design-system/components/ui/Card';
import { getAttendanceAlerts, resolveAlert } from '../services/phaseCApi';
import type { AttendanceAlertsFilters } from '../types/phaseC';

export const AttendanceAlertsPage: React.FC = () => {
  const [filters, setFilters] = useState<AttendanceAlertsFilters>({
    resolved: false, // Default: show unresolved alerts only
  });

  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-alerts', filters],
    queryFn: () => getAttendanceAlerts(filters),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ alertId, notes }: { alertId: number; notes?: string }) =>
      resolveAlert(alertId, notes ? { notes } : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-alerts'] });
    },
  });

  const alerts = data?.data || [];

  // Derive risk level from consecutiveCount
  const getRiskLevel = (count: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    if (count >= 5) return 'CRITICAL';
    if (count >= 3) return 'HIGH';
    if (count >= 2) return 'MEDIUM';
    return 'LOW';
  };

  const riskLevelLabels = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    CRITICAL: 'Nghiêm trọng',
  };

  const riskLevelColors = {
    LOW: 'bg-info/10 text-info border-info/20',
    MEDIUM: 'bg-warning/10 text-warning border-warning/20',
    HIGH: 'bg-error/10 text-error border-error/20',
    CRITICAL: 'bg-error text-white border-error',
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
      <div className="flex items-center gap-4 mb-8">
        <span className="font-label uppercase text-xs tracking-widest text-midnight/40">Lọc theo:</span>

        {/* Resolved status filter */}
        <div className="flex gap-2">
          <Button
            variant={filters.resolved === false ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilters({ ...filters, resolved: false })}
          >
            Chưa giải quyết
          </Button>
          <Button
            variant={filters.resolved === true ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilters({ ...filters, resolved: true })}
          >
            Đã giải quyết
          </Button>
          <Button
            variant={filters.resolved === undefined ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilters({ ...filters, resolved: undefined })}
          >
            Tất cả
          </Button>
        </div>
      </div>

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <Card className="p-16 text-center">
          <span className="material-symbols-outlined text-6xl text-midnight/10 mb-4">
            notifications_active
          </span>
          <p className="font-headline italic text-2xl text-midnight/20">
            Không có cảnh báo nào
          </p>
          <p className="text-sm text-midnight/40 mt-2">
            {filters.resolved === false
              ? 'Không có cảnh báo chưa giải quyết'
              : filters.resolved === true
              ? 'Không có cảnh báo đã giải quyết'
              : 'Không có cảnh báo nào trong hệ thống'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {alerts.map((alert) => {
            const riskLevel = getRiskLevel(alert.consecutiveCount);
            return (
              <Card key={alert.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-headline italic text-2xl text-midnight">
                        {alert.student.fullName}
                      </h3>
                      <span className="font-label text-xs tracking-widest text-midnight/40 bg-midnight/5 px-2 py-1 rounded">
                        {alert.student.studentCode}
                      </span>
                      <span
                        className={`font-label text-xs tracking-widest px-3 py-1 rounded-full border ${riskLevelColors[riskLevel]}`}
                      >
                        {riskLevelLabels[riskLevel]}
                      </span>
                      {alert.resolved && (
                        <span className="font-label text-xs tracking-widest px-3 py-1 rounded-full border bg-success/10 text-success border-success/20">
                          Đã giải quyết
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Lớp học
                        </span>
                        <p className="font-medium text-midnight/80">
                          {alert.trainingClass.className} ({alert.trainingClass.classCode})
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Số buổi vắng liên tục
                        </span>
                        <p className="font-headline italic text-xl text-error">
                          {alert.consecutiveCount}
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Phát hiện lúc
                        </span>
                        <p className="text-midnight/80">
                          {new Date(alert.detectedAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                      {alert.resolved && alert.resolvedAt && (
                        <div>
                          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                            Giải quyết lúc
                          </span>
                          <p className="text-midnight/80">
                            {new Date(alert.resolvedAt).toLocaleString('vi-VN')}
                          </p>
                        </div>
                      )}
                      {alert.notes && (
                        <div className="col-span-2">
                          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                            Ghi chú
                          </span>
                          <p className="text-midnight/80 italic">{alert.notes}</p>
                        </div>
                      )}
                      {alert.resolver && (
                        <div>
                          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                            Người giải quyết
                          </span>
                          <p className="text-midnight/80">{alert.resolver.fullName}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {!alert.resolved && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          const notes = prompt('Ghi chú (tùy chọn):');
                          resolveMutation.mutate({
                            alertId: alert.id,
                            notes: notes || undefined,
                          });
                        }}
                        disabled={resolveMutation.isPending}
                      >
                        <span className="material-symbols-outlined text-base mr-1">check_circle</span>
                        Đánh dấu đã giải quyết
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
};
