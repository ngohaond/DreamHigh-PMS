import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../design-system/components/layout/AppLayout';
import { PageHeader } from '../design-system/components/layout/PageHeader';
import { Button } from '../design-system/components/ui/Button';
import { Card } from '../design-system/components/ui/Card';
import { Tabs } from '../design-system/components/ui/Tabs';
import { apiClient } from '../services/apiClient';

interface ClassDetailsData {
  id: number;
  maxStudents: number;
  status: string;
  course?: { name?: string | null } | null;
  teacher?: { fullName?: string | null; email?: string | null; status?: string | null } | null;
  enrollments?: Array<{ id: number; student?: { fullName?: string | null; studentCode?: string | null } | null }> | null;
  sessions?: Array<{ id: number; startTime: string; topicNote?: string | null }> | null;
}

export const ClassDetailsPage: React.FC = () => {
  const { id: classCode } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: classData, isLoading, isError, refetch } = useQuery<{ data: ClassDetailsData }>({
    queryKey: ['class', classCode],
    queryFn: async () => {
      const response = await apiClient.get(`/classes/${classCode}`);
      return response.data;
    },
    enabled: !!classCode
  });

  const tabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'schedule', label: 'Lịch học' },
    { key: 'students', label: 'Học viên' },
    { key: 'attendance', label: 'Điểm danh' },
    { key: 'results', label: 'Kết quả' },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-160px)] animate-pulse text-midnight/20 font-label uppercase tracking-widest">
          Đang tải dữ liệu lớp học...
        </div>
      </AppLayout>
    );
  }

  if (isError || !classData?.data) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-160px)] text-error">
          <span className="material-symbols-outlined text-6xl mb-4">error_outline</span>
          <p className="font-headline italic text-xl">Không thể tải dữ liệu lớp học. Vui lòng thử lại.</p>
          <Button variant="primary" onClick={() => refetch()} className="mt-8 px-12">Thử lại</Button>
        </div>
      </AppLayout>
    );
  }

  const cls = classData.data;

  const breadcrumb = [
    { label: 'Đào tạo', href: '#' },
    { label: 'Lớp học', href: '/classes' },
    { label: 'Chi tiết' }
  ];

  return (
    <AppLayout>
      <PageHeader 
        breadcrumb={breadcrumb} 
        title={`${cls.course?.name || 'Lớp học'}`}
        action={
          <Button className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">person_add</span>
            Thêm học viên
          </Button>
        }
      />

      <Tabs 
        items={tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        className="mb-10"
      />

      {/* Detail Bento Grid */}
      <div className="grid grid-cols-12 gap-8">
        
        {/* Main Summary Section */}
        <div className="col-span-8 space-y-8">
          <Card className="p-8 h-[480px] flex flex-col justify-between shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gold" />
            
            <div>
              <h3 className="font-label uppercase tracking-ultra text-[10px] text-midnight/40 mb-8">Trạng thái vận hành</h3>
              
              <div className="grid grid-cols-3 gap-12">
                <div className="space-y-1">
                  <span className="font-label uppercase text-[10px] tracking-widest text-gold">Sĩ số hiện tại</span>
                  <p className="font-headline italic text-5xl text-midnight leading-tight">
                    {cls.enrollments?.length || 0}<span className="text-midnight/20 text-2xl ml-1">/ {cls.maxStudents}</span>
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-label uppercase text-[10px] tracking-widest text-gold">Số buổi học</span>
                  <p className="font-headline italic text-5xl text-midnight leading-tight">
                    {cls.sessions?.length || 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-label uppercase text-[10px] tracking-widest text-gold">Tình trạng</span>
                  <div className="mt-2">
                    {cls.status === 'ACTIVE' ? (
                      <span className="bg-success-bg text-success font-semibold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full border border-success/10">Đang học</span>
                    ) : (
                      <span className="bg-midnight/5 text-midnight/40 font-semibold uppercase tracking-wider text-[10px] px-3 py-1 rounded-full border border-black/5">{cls.status}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-midnight/5 rounded-xl border border-black/5 flex-1 mt-10 p-8 flex flex-col items-center justify-center group-hover:bg-midnight/[0.07] transition-colors relative overflow-hidden">
              <span className="material-symbols-outlined text-midnight/5 text-[120px] absolute">auto_graph</span>
              <p className="italic text-midnight/20 font-headline text-2xl relative z-10">Phân tích lộ trình đào tạo...</p>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-8">
            <Card className="p-8 h-72 shadow-md flex flex-col">
              <h4 className="font-label uppercase tracking-ultra text-[10px] text-gold mb-6">Học viên tiêu biểu ({cls.enrollments?.length || 0})</h4>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {cls.enrollments?.map((enrollment) => (
                   <div key={enrollment.id} className="pb-3 border-b border-black/5 flex justify-between items-center group hover:bg-midnight/[0.02] transition-colors -mx-2 px-2 py-1 rounded-lg">
                     <span className="font-body text-base text-midnight/90 font-medium">{enrollment.student?.fullName}</span>
                     <span className="font-label text-[10px] tracking-widest text-gold bg-gold/5 px-2 py-1 rounded-md">{enrollment.student?.studentCode}</span>
                   </div>
                ))}
                {!cls.enrollments?.length && <p className="text-sm text-midnight/20 italic">Chưa có học viên nào trong lớp này</p>}
              </div>
            </Card>

            <Card className="p-8 h-72 shadow-md flex flex-col">
              <h4 className="font-label uppercase tracking-ultra text-[10px] text-gold mb-6">Lịch sử giảng dạy</h4>
              <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {cls.sessions?.length === 0 ? <p className="text-midnight/20 text-sm italic">Chưa có buổi học nào được ghi nhận</p> : null}
                {cls.sessions?.map((session) => (
                   <div key={session.id} className="pb-3 border-b border-black/5 pt-1">
                     <span className="font-body text-base text-midnight/90 font-medium">{new Date(session.startTime).toLocaleDateString('vi-VN')}</span>
                     <p className="text-midnight/40 text-xs mt-1 line-clamp-1">{session.topicNote || 'Không có ghi chú chủ đề'}</p>
                   </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="col-span-4 space-y-8">
          
          <Card variant="financial" className="p-8 shadow-xl">
            <h3 className="font-label uppercase tracking-ultra text-[10px] text-gold/60 mb-8 border-b border-white/10 pb-4">
              Giảng viên phụ trách
            </h3>
            
            <div className="flex items-center gap-5 mb-10">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold text-2xl font-headline italic">
                 {cls.teacher?.fullName?.charAt(0) || '?'}
              </div>
              <div>
                <h4 className="font-headline italic text-3xl text-white">{cls.teacher?.fullName || 'Chưa phân công'}</h4>
                <p className="font-label uppercase tracking-ultra text-[9px] text-white/40 mt-2">{cls.teacher?.email || 'N/A'}</p>
              </div>
            </div>
            
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="flex justify-between items-center font-label uppercase text-[10px] tracking-widest text-white/40">
                <span>Trạng thái</span>
                <span className="text-white bg-white/10 px-3 py-1 rounded-full text-[9px] tracking-normal border border-white/5">{cls.teacher?.status || 'UNKNOWN'}</span>
              </div>
              <Button variant="ghost" className="w-full !border-white/10 !text-white/60 hover:!text-white hover:!bg-white/5 mt-4">
                Xem hồ sơ chi tiết
              </Button>
            </div>
          </Card>
          
          <Card className="p-8 shadow-md">
            <h3 className="font-label uppercase tracking-ultra text-[10px] text-gold mb-6">Tài liệu lớp học</h3>
            <div className="space-y-4">
               <div className="flex items-center gap-3 p-3 rounded-xl bg-midnight/5 border border-black/5 cursor-pointer hover:border-gold/30 transition-all">
                  <span className="material-symbols-outlined text-gold">description</span>
                  <span className="text-sm font-medium text-midnight/80">Syllabus_Level1.pdf</span>
               </div>
               <Button variant="ghost" className="w-full text-xs opacity-40">Tất cả tài liệu (4)</Button>
            </div>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
};
