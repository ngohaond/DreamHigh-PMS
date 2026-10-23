import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input, TextArea, Select } from '../../design-system/components/ui/Input';
import { apiClient } from '../../services/apiClient';

type LeadStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST';
type LeadGender = 'MALE' | 'FEMALE' | 'OTHER';
interface LeadRecord {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: LeadStatus;
}
interface LeadDraft { fullName: string; phone: string; email: string; notes: string }

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({ fullName: '', phone: '', email: '', notes: '' });
  const [convertData, setConvertData] = useState<{ dob: string; gender: LeadGender }>({ dob: '', gender: 'MALE' });

  const { data: leads = [], isLoading } = useQuery<LeadRecord[]>({
    queryKey: ['crm-leads'],
    queryFn: async () => {
      const resp = await apiClient.get('/leads');
      const payload = resp.data as LeadRecord[] | { data?: LeadRecord[] };
      return Array.isArray(payload) ? payload : payload.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: LeadDraft) => apiClient.post('/leads', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      setIsModalOpen(false);
      setFormData({ fullName: '', phone: '', email: '', notes: '' });
    },
  });

  const convertMutation = useMutation({
    mutationFn: (data: { dob: string; gender: LeadGender; branchId: number }) => {
      if (!selectedLead) throw new Error('Vui lòng chọn lead cần chuyển đổi');
      return apiClient.post(`/enrollment/leads/${selectedLead.id}/convert`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['crm-students'] });
      setIsConvertModalOpen(false);
      alert('Chuyển đổi thành công!');
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
      alert(typeof message === 'string' ? message : 'Có lỗi xảy ra');
    },
  });

  return (
    <AppLayout>
      <PageHeader 
        title="Quản lý Tiềm năng" 
        breadcrumb={[{ label: 'CRM', href: '#' }, { label: 'Leads' }]}
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">add</span>
            Thêm Lead
          </Button>
        }
      />

      <Card className="mt-8 p-0 overflow-hidden shadow-md">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-midnight/5 border-b border-black/5">
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-left">Họ tên & Liên hệ</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-center">Trạng thái</th>
              <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {isLoading ? (
              <tr><td colSpan={3} className="px-6 py-12 text-center text-midnight/20">Đang tải dữ liệu...</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-midnight/[0.02] transition-colors group">
                  <td className="px-6 py-4 text-left">
                    <div className="flex flex-col">
                      <span className="font-body text-base text-midnight/90 font-medium">{lead.fullName}</span>
                      <span className="font-body text-xs text-midnight/40">{lead.phone} • {lead.email || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                      lead.status === 'CONVERTED' ? 'bg-success-bg text-success' :
                      lead.status === 'NEW' ? 'bg-warning-bg text-warning' :
                      'bg-midnight/5 text-midnight/40'
                    }`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {lead.status !== 'CONVERTED' ? (
                      <Button 
                        variant="ghost"
                        onClick={() => { setSelectedLead(lead); setIsConvertModalOpen(true); }}
                        className="h-8 px-4 text-[10px]"
                      >
                        Chuyển đổi
                      </Button>
                    ) : (
                      <span className="text-[10px] font-label uppercase tracking-widest text-midnight/20">Đã nhập học</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight/40 backdrop-blur-sm">
          <Card className="w-full max-w-md p-8 shadow-lg">
            <h3 className="text-2xl font-headline italic text-gold mb-8">Thêm khách hàng tiềm năng</h3>
            <div className="space-y-6">
              <Input 
                label="Họ tên học viên"
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={e => setFormData({...formData, fullName: e.target.value})}
              />
              <Input 
                label="Số điện thoại"
                placeholder="0901234567"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
              <Input 
                label="Email"
                placeholder="example@email.com"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
              />
              <TextArea 
                label="Ghi chú"
                placeholder="Nhu cầu học tập, trình độ hiện tại..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
              <div className="flex gap-4 pt-6">
                <Button variant="ghost" className="flex-1" onClick={() => setIsModalOpen(false)}>Hủy</Button>
                <Button 
                  className="flex-1"
                  onClick={() => createMutation.mutate(formData)}
                >
                  Lưu hồ sơ
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Convert Modal */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight/40 backdrop-blur-sm">
          <Card className="w-full max-w-md p-8 shadow-lg">
            <h3 className="text-2xl font-headline italic text-gold mb-8">Chuyển đổi Học viên</h3>
            <div className="space-y-6">
              <Input 
                type="date"
                label="Ngày sinh học viên"
                value={convertData.dob}
                onChange={e => setConvertData({...convertData, dob: e.target.value})}
              />
              <Select 
                label="Giới tính"
                value={convertData.gender}
                onChange={e => setConvertData({ ...convertData, gender: e.target.value as LeadGender })}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </Select>
              <div className="flex gap-4 pt-6">
                <Button variant="ghost" className="flex-1" onClick={() => setIsConvertModalOpen(false)}>Hủy</Button>
                <Button 
                  className="flex-1"
                  onClick={() => convertMutation.mutate({ ...convertData, branchId: 1 })}
                >
                  Xác nhận nhập học
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
