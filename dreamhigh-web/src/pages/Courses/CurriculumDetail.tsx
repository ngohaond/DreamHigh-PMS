import React, { useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Bookmark,
  BookCopy,
  Eye,
  FileSpreadsheet,
  FileText,
  Library,
  Upload,
} from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import type { AdminMessage } from '../../types/adminSystem';
import type { CurriculumLesson, CurriculumProgram } from '../../types/curriculum';
import { getCurriculumLessonBadgeClass } from '../../utils/curriculumUi';
import NotificationPortal from '../Admin/system/NotificationPortal';
import { getIcon } from '../Admin/system/adminSystemIcons';
import CurriculumLessonDetailModal from './CurriculumLessonDetailModal';
import GlobalResourcesModal from './GlobalResourcesModal';

export interface CurriculumDetailProps {
  program: CurriculumProgram;
  onBack: () => void;
  onUpdate: (program: CurriculumProgram) => void;
}

function resequenceLessons(baseLessons: CurriculumLesson[]): CurriculumLesson[] {
  const sortedLessons = [...baseLessons].sort((a, b) => {
    if (a.teachingDate && b.teachingDate) {
      return a.teachingDate.localeCompare(b.teachingDate);
    }
    if (a.teachingDate) return -1;
    if (b.teachingDate) return 1;
    return a.id.localeCompare(b.id);
  });

  let currentStt = 1;
  return sortedLessons.map((l) => {
    if (l.executionStatus === 'Huỷ') {
      return { ...l, stt: 0 };
    }
    return { ...l, stt: currentStt++ };
  });
}

interface MaterialCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  accentClass: string;
  onEdit: () => void;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ title, value, icon, accentClass, onEdit }) => (
  <Card className="relative flex flex-col gap-3 overflow-hidden p-6 shadow-sm">
    <div className={`absolute left-0 top-0 h-full w-1.5 ${accentClass}`} aria-hidden />
    <div className="flex items-center justify-between pl-2">
      <span className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">{title}</span>
      <span className="text-midnight/50">{icon}</span>
    </div>
    <h4 className="min-h-[3rem] pl-2 font-headline text-lg italic leading-tight text-midnight line-clamp-2">
      {value || 'Chưa cập nhật'}
    </h4>
    <div className="mt-auto flex items-center justify-between border-t border-midnight/5 pt-4 pl-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 font-label text-[10px] font-semibold uppercase tracking-wider text-gold transition-colors hover:text-midnight"
      >
        <Upload size={12} strokeWidth={2} aria-hidden />
        Cập nhật học liệu
      </button>
      {value ? (
        <button type="button" className="rounded-lg bg-midnight/5 p-1.5 text-midnight/40 transition-colors hover:text-info" title="Xem tài liệu">
          <Eye size={14} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  </Card>
);

const CurriculumDetail: React.FC<CurriculumDetailProps> = ({ program, onBack, onUpdate }) => {
  const [lessonState, setLessonState] = useState(() => ({
    programId: program.id,
    lessons: resequenceLessons(program.lessons),
  }));
  const lessons = lessonState.programId === program.id ? lessonState.lessons : resequenceLessons(program.lessons);
  const setLessons = (nextLessons: CurriculumLesson[]) => setLessonState({ programId: program.id, lessons: nextLessons });
  const [editingLesson, setEditingLesson] = useState<CurriculumLesson | null>(null);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [isResourcesModalOpen, setIsResourcesModalOpen] = useState(false);
  const [message, setMessage] = useState<AdminMessage | null>(null);

  const showNotification = (code: string, text: string, type: AdminMessage['type']) => {
    setMessage({ code, text, type });
  };

  const handleUpdateLesson = (updatedLesson: CurriculumLesson) => {
    let baseLessons = [...lessons];

    if (isAddingLesson) {
      const newLesson = { ...updatedLesson, id: `l-${Date.now()}` };
      baseLessons.push(newLesson);
      showNotification('NOTI-305', 'Thêm mới buổi học thành công.', 'success');
    } else {
      baseLessons = baseLessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l));
      showNotification('NOTI-304', 'Cập nhật nội dung buổi học thành công.', 'success');
    }

    const finalLessons = resequenceLessons(baseLessons);
    setLessons(finalLessons);
    onUpdate({ ...program, lessons: finalLessons });
    setEditingLesson(null);
    setIsAddingLesson(false);
  };

  const handleSaveResources = (data: Pick<CurriculumProgram, 'textbook' | 'studentBook' | 'brochure' | 'globalMaterials'>) => {
    onUpdate({ ...program, ...data });
    setIsResourcesModalOpen(false);
    showNotification('NOTI-302', 'Cập nhật học liệu toàn khóa thành công.', 'success');
  };

  const handleImportExcel = () => {
    const mockImportedLessons: CurriculumLesson[] = [
      {
        id: 'imp-1',
        stt: 0,
        executionStatus: 'Chưa bắt đầu',
        teachingDate: '2026-04-01',
        teacherName: 'Imported Teacher',
        assistantName: '',
        documents: [],
        content: 'Lesson imported from Excel (A)',
        homework: 'Exercise A',
        teacherGuideline: '',
      },
      {
        id: 'imp-2',
        stt: 0,
        executionStatus: 'Chưa bắt đầu',
        teachingDate: '2026-04-03',
        teacherName: 'Imported Teacher',
        assistantName: '',
        documents: [],
        content: 'Lesson imported from Excel (B)',
        homework: 'Exercise B',
        teacherGuideline: '',
      },
    ];

    const final = resequenceLessons([...lessons, ...mockImportedLessons]);
    setLessons(final);
    onUpdate({ ...program, lessons: final });
    showNotification('NOTI-303', 'Import thành công và tự động đánh lại STT toàn bộ lộ trình.', 'success');
  };

  const handleAddNewManual = () => {
    setIsAddingLesson(true);
    const newLessonTemplate: CurriculumLesson = {
      id: '',
      stt: 0,
      executionStatus: 'Chưa bắt đầu',
      content: '',
      teachingDate: new Date().toISOString().split('T')[0],
      teacherName: '',
      assistantName: '',
      documents: [],
      homework: '',
      teacherGuideline: '',
    };
    setEditingLesson(newLessonTemplate);
  };

  const activeCount = lessons.filter((l) => l.executionStatus !== 'Huỷ').length;

  return (
    <div className="animate-fade-in flex flex-col gap-8 pb-20">
      <NotificationPortal message={message} onClose={() => setMessage(null)} />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-midnight/50 transition-colors hover:bg-midnight/5"
            aria-label="Quay lại"
          >
            <span className="inline-block rotate-180">{getIcon('ChevronRight', 24)}</span>
          </button>
          <div>
            <h1 className="font-headline text-2xl italic text-midnight">
              Chi tiết Syllabus: <span className="text-gold">{program.code}</span>
            </h1>
            <p className="font-body text-sm text-midnight/55">{program.name}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="gap-2 bg-success text-white hover:opacity-90" onClick={handleImportExcel}>
          <FileSpreadsheet size={20} strokeWidth={2} aria-hidden />
          Import lộ trình (Excel)
        </Button>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <MaterialCard
          title="01. Coursebook"
          value={program.textbook}
          icon={<Bookmark size={16} strokeWidth={2} aria-hidden />}
          accentClass="bg-gold"
          onEdit={() => setIsResourcesModalOpen(true)}
        />
        <MaterialCard
          title="02. Student Book"
          value={program.studentBook || ''}
          icon={<BookCopy size={16} strokeWidth={2} aria-hidden />}
          accentClass="bg-midnight"
          onEdit={() => setIsResourcesModalOpen(true)}
        />
        <MaterialCard
          title="03. Brochure"
          value={program.brochure || ''}
          icon={<FileText size={16} strokeWidth={2} aria-hidden />}
          accentClass="bg-warning"
          onEdit={() => setIsResourcesModalOpen(true)}
        />
        <MaterialCard
          title="04. Global materials"
          value={program.globalMaterials || ''}
          icon={<Library size={16} strokeWidth={2} aria-hidden />}
          accentClass="bg-info"
          onEdit={() => setIsResourcesModalOpen(true)}
        />
      </div>

      <Card className="flex flex-col overflow-hidden p-0 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-midnight px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-gold p-2 text-midnight">
              <FileText size={20} strokeWidth={2} aria-hidden />
            </div>
            <div>
              <h3 className="font-label text-lg font-semibold uppercase tracking-tight">Chi tiết lộ trình đào tạo</h3>
              <p className="mt-0.5 font-label text-[10px] font-semibold uppercase tracking-widest text-white/50">
                Tự động đánh lại STT khi có buổi &quot;HUỶ&quot; (N/A)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" className="gap-2 text-xs" onClick={handleAddNewManual}>
              {getIcon('Plus', 14)} Thêm buổi học manual
            </Button>
            <span className="rounded-full border border-gold/30 bg-gold/15 px-3 py-1 font-label text-xs font-semibold text-gold">
              {activeCount} buổi học hiệu lực
            </span>
          </div>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-[1550px] w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-midnight/10 bg-midnight/5">
                <th className="w-24 px-4 py-4 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  STT
                </th>
                <th className="w-32 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Trạng thái
                </th>
                <th className="w-32 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Ngày dạy
                </th>
                <th className="w-40 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  GV
                </th>
                <th className="w-40 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Trợ giảng
                </th>
                <th className="w-80 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Nội dung
                </th>
                <th className="w-48 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Tài liệu
                </th>
                <th className="w-48 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  BTVN
                </th>
                <th className="w-48 px-4 py-4 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Lưu ý
                </th>
                <th className="w-24 px-4 py-4 pr-6 text-right font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight/5">
              {lessons.length > 0 ? (
                lessons.map((lesson) => (
                  <tr
                    key={lesson.id}
                    className={`transition-colors hover:bg-midnight/[0.02] ${lesson.executionStatus === 'Huỷ' ? 'bg-error-bg/40' : ''}`}
                  >
                    <td className="px-4 py-5 text-center">
                      {lesson.executionStatus === 'Huỷ' ? (
                        <div className="flex flex-col items-center">
                          <span className="inline-flex rounded bg-error px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-tighter text-white shadow-sm">
                            N/A
                          </span>
                          <span className="mt-1 font-label text-[8px] font-semibold uppercase text-error">Buổi huỷ</span>
                        </div>
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-midnight font-label text-xs font-semibold text-gold shadow-md">
                          {lesson.stt}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-5">
                      <span
                        className={`inline-flex rounded-lg border px-2 py-1 font-label text-[10px] font-semibold uppercase tracking-tight ${getCurriculumLessonBadgeClass(lesson.executionStatus)}`}
                      >
                        {lesson.executionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      <p className="font-body text-xs font-semibold text-midnight">{lesson.teachingDate || '--/--/----'}</p>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2 truncate">
                        <span className="rounded bg-gold/15 p-1 text-gold">{getIcon('UserCheck', 12)}</span>
                        <span className="truncate font-body text-xs font-semibold text-midnight" title={lesson.teacherName}>
                          {lesson.teacherName || 'Chưa phân công'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2 truncate text-midnight/55">
                        <span className="rounded bg-midnight/5 p-1">{getIcon('Users', 12)}</span>
                        <span className="truncate font-body text-xs" title={lesson.assistantName}>
                          {lesson.assistantName || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <p className="line-clamp-2 font-body text-xs font-medium leading-relaxed text-midnight/80" title={lesson.content}>
                        {lesson.executionStatus === 'Huỷ' ? (
                          <span className="font-semibold italic text-error">[HUỶ] {lesson.offReason}</span>
                        ) : (
                          lesson.content
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex flex-wrap gap-1">
                        {lesson.documents && lesson.documents.length > 0 ? (
                          lesson.documents.map((doc, dIdx) => (
                            <span
                              key={dIdx}
                              className="inline-flex max-w-[100px] items-center gap-1 truncate rounded border border-info/25 bg-info-bg px-1.5 py-0.5 font-label text-[9px] font-semibold text-info"
                              title={doc}
                            >
                              <FileText size={10} strokeWidth={2} className="shrink-0 opacity-80" aria-hidden /> {doc}
                            </span>
                          ))
                        ) : (
                          <span className="font-body text-[10px] italic text-midnight/40">Không có</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <p
                        className="line-clamp-2 rounded border border-warning/25 bg-warning-bg px-2 py-1 font-label text-[10px] font-semibold text-warning"
                        title={lesson.homework}
                      >
                        {lesson.homework || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p
                        className="line-clamp-2 font-body text-[10px] italic leading-relaxed text-midnight/50"
                        title={lesson.teacherGuideline}
                      >
                        {lesson.teacherGuideline || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-5 pr-6 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingLesson(false);
                          setEditingLesson(lesson);
                        }}
                        className="rounded-xl border border-midnight/15 bg-surface p-2.5 text-midnight/40 transition-all hover:border-gold hover:text-gold hover:shadow-sm"
                        title="Chỉnh sửa buổi"
                      >
                        {getIcon('Edit', 18)}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <AlertCircle size={48} strokeWidth={1.25} aria-hidden />
                      <p className="mt-4 font-label text-sm font-semibold uppercase tracking-widest text-midnight">
                        Lộ trình trống — Import Excel hoặc thêm buổi manual
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CurriculumLessonDetailModal
        lesson={editingLesson}
        isOpen={!!editingLesson}
        isAdding={isAddingLesson}
        onClose={() => {
          setEditingLesson(null);
          setIsAddingLesson(false);
        }}
        onSave={handleUpdateLesson}
      />

      <GlobalResourcesModal
        program={program}
        isOpen={isResourcesModalOpen}
        onClose={() => setIsResourcesModalOpen(false)}
        onSave={handleSaveResources}
      />
    </div>
  );
};

export default CurriculumDetail;
