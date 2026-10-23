import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '../../design-system/components/layout/AppLayout';
import { PageHeader } from '../../design-system/components/layout/PageHeader';
import { Card } from '../../design-system/components/ui/Card';
import { Tabs } from '../../design-system/components/ui/Tabs';
import { apiClient } from '../../services/apiClient';

interface ProgramRow { id: number; code: string; name: string; status: string }
interface LevelRow { id: number; code: string; name: string; program?: { name: string } | null }
interface RoomRow { id: number; roomCode: string; name: string | null; capacity: number }

export default function CategoryManagerPage() {
  const [activeTab, setActiveTab] = useState('programs');

  const { data: programs = [], isLoading: isLoadingPrograms, error: errorPrograms } = useQuery<ProgramRow[]>({
    queryKey: ['admin-programs'],
    queryFn: async () => {
      const resp = await apiClient.get('/categories/programs');
      return resp.data as ProgramRow[];
    },
  });

  const { data: levels = [], isLoading: isLoadingLevels, error: errorLevels } = useQuery<LevelRow[]>({
    queryKey: ['admin-levels'],
    queryFn: async () => {
      const resp = await apiClient.get('/categories/levels');
      return resp.data as LevelRow[];
    },
  });

  const { data: rooms = [], isLoading: isLoadingRooms, error: errorRooms } = useQuery<RoomRow[]>({
    queryKey: ['admin-rooms'],
    queryFn: async () => {
      const resp = await apiClient.get('/categories/rooms');
      return resp.data as RoomRow[];
    },
  });

  const categoriesTabs = [
    { key: 'programs', label: 'Chương trình (Programs)' },
    { key: 'levels', label: 'Cấp độ (Levels)' },
    { key: 'rooms', label: 'Phòng học (Rooms)' },
  ];

  return (
    <AppLayout>
      <PageHeader 
        title="Quản lý Danh mục" 
        breadcrumb={[
          { label: 'Hệ thống', href: '#' },
          { label: 'Danh mục' }
        ]}
      />

      <div className="mt-8">
        <Tabs items={categoriesTabs} activeKey={activeTab} onChange={setActiveTab} />
      </div>

      <Card className="mt-8 p-0 overflow-hidden shadow-md">
        {activeTab === 'programs' && (
          <div>
            <div className="p-6 border-b border-black/5 bg-midnight/5">
              <h3 className="text-xl font-headline italic text-gold">Danh sách Chương trình học</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-midnight/5 border-b border-black/5">
                <tr>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Mã</th>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Tên chương trình</th>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {isLoadingPrograms ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-midnight/20">Đang tải dữ liệu...</td></tr>
                ) : errorPrograms ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-error">Không thể tải danh sách chương trình.</td></tr>
                ) : (
                  programs.map((program) => (
                    <tr key={program.id} className="hover:bg-midnight/[0.02] transition-colors group text-right">
                      <td className="px-6 py-4 text-left font-medium text-gold/80">{program.code}</td>
                      <td className="px-6 py-4 text-left font-body text-base text-midnight/90">{program.name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-semibold bg-success-bg text-success uppercase tracking-wider">
                          {program.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
                {(!isLoadingPrograms && (!programs || programs.length === 0)) && (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-midnight/20 italic">Chưa có Chương trình nào được tạo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'levels' && (
          <div>
            <div className="p-6 border-b border-black/5 bg-midnight/5">
              <h3 className="text-xl font-headline italic text-gold">Danh sách Cấp độ (Levels)</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-midnight/5 border-b border-black/5">
                <tr>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Mã</th>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold">Tên cấp độ</th>
                  <th className="px-6 py-4 font-label uppercase text-[10px] tracking-ultra text-gold text-right">Chương trình</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {isLoadingLevels ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-midnight/20">Đang tải dữ liệu...</td></tr>
                ) : errorLevels ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-error">Không thể tải danh sách cấp độ.</td></tr>
                ) : (
                  levels.map((level) => (
                    <tr key={level.id} className="hover:bg-midnight/[0.02] transition-colors group text-right">
                      <td className="px-6 py-4 text-left font-medium text-gold/80">{level.code}</td>
                      <td className="px-6 py-4 text-left font-body text-base text-midnight/90">{level.name}</td>
                      <td className="px-6 py-4 text-right font-body text-sm italic text-midnight/40">{level.program?.name}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'rooms' && (
          <div className="p-6">
            <h3 className="text-xl font-headline italic text-gold mb-6">Danh sách Phòng học (Rooms)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoadingRooms ? (
                <div className="col-span-full py-12 text-center text-midnight/20">Đang tải dữ liệu phòng...</div>
              ) : errorRooms ? (
                <div className="col-span-full py-12 text-center text-error">Không thể tải danh sách phòng.</div>
              ) : (
                rooms.map((room) => (
                  <Card key={room.id} className="p-6 ghost-border bg-surface hover:border-gold/30 hover:shadow-md transition-all group">
                     <div className="flex justify-between items-start mb-4">
                        <span className="font-label text-base tracking-widest text-gold">{room.roomCode}</span>
                        <span className="material-symbols-outlined text-gold/40 group-hover:text-gold transition-colors">meeting_room</span>
                     </div>
                     <div className="space-y-2">
                       <h4 className="font-body text-base text-midnight/90 font-medium">{room.name || 'Phòng học'}</h4>
                       <div className="flex items-center gap-2 text-[11px] font-label uppercase tracking-widest text-midnight/40">
                         <span className="material-symbols-outlined text-sm">groups</span>
                         {room.capacity} chỗ ngồi
                       </div>
                     </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </Card>
    </AppLayout>
  );
}
