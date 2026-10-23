import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input } from '../../design-system/components/ui/Input';
import { apiClient } from '../../services/apiClient';

interface StudentListItem {
  id: number;
  fullName: string;
  studentCode: string;
  dob: string;
  status: string;
  parent?: { fullName?: string | null; phone?: string | null } | null;
}

function normalizeListPayload<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const data = (raw as { data?: unknown }).data;
    return Array.isArray(data) ? data as T[] : [];
  }
  return [];
}

export default function StudentListPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const { data: studentsRaw, isLoading } = useQuery({
    queryKey: ['crm-students', debouncedSearch],
    queryFn: async () => {
      const resp = await apiClient.get('/students', { params: { search: debouncedSearch || undefined } });
      return resp.data;
    },
  });

  const students = normalizeListPayload<StudentListItem>(studentsRaw);

  return (
    <AppLayout>
      <PageHeader
        title="Danh sách Học viên"
        breadcrumb={[{ label: 'CRM', href: '#' }, { label: 'Học viên' }]}
        action={
          <Button type="button" variant="secondary" onClick={() => navigate('/crm/students/manage')}>
            Hồ sơ &amp; học phí (mock)
          </Button>
        }
      />

      {/* Search & Filter Bar */}
      <Card className="mt-8 mb-6 p-4 bg-midnight shadow-lg border-white/5">
        <div className="relative flex-1 group">
          <span className="material-symbols-outlined absolute left-4 top-3 text-gold/60 group-hover:text-gold transition-colors">search</span>
          <Input 
            placeholder="Tìm kiếm theo Tên, Mã HV hoặc SĐT phụ huynh..."
            className="pl-12 !h-12 border-white/10 text-white focus:border-gold"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-midnight/5 border-b border-black/5">
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-left">Học viên</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-center">Mã HV</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Phụ huynh</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-midnight/20">Đang tải dữ liệu...</td></tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-midnight/20 italic">
                  Chưa tìm thấy học viên phù hợp.
                </td>
              </tr>
            ) : (
              students.map((student) => (
                <tr
                  key={student.id}
                  role="button"
                  tabIndex={0}
                  className="hover:bg-midnight/[0.02] cursor-pointer transition-colors group"
                  onClick={() => navigate(`/crm/students/${student.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/crm/students/${student.id}`);
                    }
                  }}
                >
                  <td className="px-6 py-4 text-left">
                    <div className="flex flex-col">
                      <span className="font-body text-base text-midnight/90 font-medium">{student.fullName}</span>
                      <span className="font-body text-xs text-midnight/40">{new Date(student.dob).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-label text-[11px] tracking-wider text-gold bg-gold/5 px-3 py-1 rounded-md border border-gold/10">
                      {student.studentCode}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="font-body text-base text-midnight/90 font-medium">{student.parent?.fullName || 'N/A'}</span>
                       <span className="font-body text-xs text-midnight/40">{student.parent?.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      student.status === 'ACTIVE' ? 'bg-success-bg text-success' :
                      'bg-midnight/5 text-midnight/40'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppLayout>
  );
}
