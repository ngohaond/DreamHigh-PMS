import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Card } from '../../design-system/components/ui/Card';
import { Button } from '../../design-system/components/ui/Button';
import { apiClient } from '../../services/apiClient';

interface AuditLogRow {
  id: number;
  createdAt: string;
  action: string;
  resource: string;
  recordId: string | null;
  ipAddress: string | null;
  details: { payload?: unknown } | null;
  user: { fullName: string; email: string } | null;
}

export default function AuditLogPage() {
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const { data: logs = [], isLoading, error } = useQuery<AuditLogRow[]>({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const resp = await apiClient.get('/audit-logs');
      return (resp.data.data ?? []) as AuditLogRow[];
    },
  });

  const closeModal = () => setSelectedLog(null);

  return (
    <AppLayout>
      <PageHeader 
        title="Nhật ký Hệ thống" 
        breadcrumb={[
          { label: 'Hệ thống', href: '#' },
          { label: 'Nhật ký' }
        ]}
      />

      <Card className="mt-8 p-0 overflow-hidden shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-midnight/5 border-b border-black/5">
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-left">Thời gian</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Người thực hiện</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Hành động</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-midnight/20">Đang tải dữ liệu...</td></tr>
            ) : error ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-error">Có lỗi xảy ra khi tải dữ liệu nhật ký.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-midnight/[0.02] transition-colors group">
                  <td className="px-6 py-4 font-body text-xs text-midnight/40 text-left">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-6 py-4">
                     <span className="font-body text-base text-midnight/90 font-medium">{log.user?.fullName || 'Hệ thống'}</span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center w-fit px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          log.action === 'CREATE' ? 'bg-success-bg text-success' :
                          log.action === 'UPDATE' ? 'bg-info-bg text-info' :
                          'bg-error-bg text-error'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-gold uppercase tracking-widest font-medium opacity-60">
                          {log.resource} {log.recordId && `#${log.recordId}`}
                        </span>
                     </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost"
                      onClick={() => setSelectedLog(log)}
                      className="h-8 px-4 text-[10px] gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      Xem
                    </Button>
                  </td>
                </tr>
              )) || (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-midnight/20 italic">Chưa có nhật ký hoạt động nào được ghi lại.</td></tr>
              )
            )}
          </tbody>
        </table>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight/40 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl p-0 overflow-hidden bg-surface relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
            
            <div className="p-8 border-b border-black/5 flex justify-between items-center bg-midnight/5">
              <div>
                <h3 className="text-2xl font-headline italic text-gold">Chi tiết Nhật ký</h3>
                <p className="text-[10px] font-label uppercase tracking-widest text-midnight/40 mt-1">
                  ID: #{selectedLog.id} • {new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <Button 
                variant="ghost"
                onClick={closeModal}
                className="w-10 h-10 p-0 rounded-full flex items-center justify-center"
              >
                <span className="material-symbols-outlined">close</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-8">
                <div className="p-6 rounded-xl bg-midnight/5 border border-black/5">
                  <span className="block text-[10px] font-label uppercase tracking-widest text-midnight/40 mb-2">Người thực hiện</span>
                  <span className="text-base font-medium text-midnight/90">{selectedLog.user?.fullName || 'Hệ thống'}</span>
                  <span className="block text-xs text-midnight/40">{selectedLog.user?.email || 'N/A'}</span>
                </div>
                <div className="p-6 rounded-xl bg-midnight/5 border border-black/5">
                  <span className="block text-[10px] font-label uppercase tracking-widest text-midnight/40 mb-2">Thiết bị / IP</span>
                  <span className="text-base font-medium text-midnight/90">{selectedLog.ipAddress || '127.0.0.1'}</span>
                  <span className="block text-xs text-midnight/40 font-mono">DH-AGENT/1.0</span>
                </div>
              </div>

              {/* Payload Data */}
              <div>
                <span className="block text-[10px] font-label uppercase tracking-widest text-gold mb-4">Dữ liệu thay đổi (Payload)</span>
                <div className="rounded-xl bg-midnight text-white p-6 overflow-hidden shadow-inner">
                  <pre className="text-xs font-mono text-gold/80 overflow-x-auto leading-relaxed">
                    {JSON.stringify(selectedLog.details?.payload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-8 border-t border-black/5 bg-midnight/5 flex justify-end">
              <Button variant="ghost" className="px-8" onClick={closeModal}>
                Đóng
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
