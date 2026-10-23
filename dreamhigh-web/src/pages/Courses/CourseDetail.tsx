import React, { useMemo, useState } from 'react';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { MOCK_COURSE_STUDENTS, MOCK_CURRICULUM } from '../../mock/courseManagement';
import type { AdminMessage } from '../../types/adminSystem';
import type {
  Course,
  CourseLesson,
  CourseRosterStudent,
  SyllabusCurriculum,
} from '../../types/course';
import type { CourseStudentRef } from '../../types/attendance';
import { getCourseStatusStyles, getLessonExecutionStyles } from '../../utils/courseUi';
import AttendanceModal from '../Classes/AttendanceModal';
import NotificationPortal from '../Admin/system/NotificationPortal';
import { getIcon } from '../Admin/system/adminSystemIcons';
import ClassFeedbackModal from './ClassFeedbackModal';
import LessonDetailModal from './LessonDetailModal';
import StudentProgressCheck from './StudentProgressCheck';

export interface CourseDetailProps {
  course: Course;
  onBack: () => void;
}

const CourseDetail: React.FC<CourseDetailProps> = ({ course, onBack }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'log' | 'progress'>('info');
  const [message, setMessage] = useState<AdminMessage | null>(null);
  const [editingLesson, setEditingLesson] = useState<Partial<CourseLesson> | null>(null);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [attendanceLesson, setAttendanceLesson] = useState<CourseLesson | null>(null);
  const [feedbackLesson, setFeedbackLesson] = useState<CourseLesson | null>(null);

  const syllabus = useMemo<SyllabusCurriculum>(
    () => MOCK_CURRICULUM.find((s) => s.id === course.syllabusId) ?? MOCK_CURRICULUM[0],
    [course.syllabusId],
  );

  const [courseLessons, setCourseLessons] = useState<CourseLesson[]>(() =>
    syllabus.lessons.map((l) => ({ ...l })),
  );

  const students: CourseRosterStudent[] = useMemo(
    () => MOCK_COURSE_STUDENTS.filter((s) => s.courseId === course.id),
    [course.id],
  );

  const attendanceStudents: CourseStudentRef[] = useMemo(
    () => students.map((s) => ({ id: s.id, studentName: s.studentName })),
    [students],
  );

  const completedCount = courseLessons.filter((l) => l.executionStatus === 'Đã hoàn thành').length;
  const totalCount = courseLessons.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleUpdateLesson = (updatedLesson: CourseLesson) => {
    let newList = [...courseLessons];
    if (isAddingLesson) {
      const newLesson: CourseLesson = {
        ...updatedLesson,
        id: updatedLesson.id || `l-course-${Date.now()}`,
      };
      newList.push(newLesson);
    } else {
      newList = newList.map((l) => (l.id === updatedLesson.id ? { ...updatedLesson } : l));
    }

    let currentStt = 1;
    const finalSequence = newList.map((l) => ({
      ...l,
      stt: l.executionStatus === 'Huỷ' ? 0 : currentStt++,
    }));

    setCourseLessons(finalSequence);
    setEditingLesson(null);
    setIsAddingLesson(false);
    setMessage({ code: 'LOG-SUCCESS', text: 'Đã lưu thay đổi lộ trình.', type: 'success' });
  };

  const handleAttendanceSave = (recs: import('../../types/attendance').AttendanceRecord[]) => {
    if (!attendanceLesson) return;
    setCourseLessons((prev) =>
      prev.map((l) => (l.id === attendanceLesson.id ? { ...l, attendance: recs } : l)),
    );
    setAttendanceLesson(null);
    setMessage({ code: 'ATT-200', text: 'Đã lưu điểm danh buổi học.', type: 'success' });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <NotificationPortal message={message} onClose={() => setMessage(null)} />

      <Card className="flex flex-col gap-4 p-6 shadow-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full p-2 text-midnight/45 transition-colors hover:bg-midnight/5 hover:text-midnight"
            aria-label="Quay lại"
          >
            <ChevronLeft size={24} strokeWidth={2} aria-hidden />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-headline text-2xl font-medium italic tracking-tight text-midnight">{course.name}</h2>
              <span
                className={`rounded-full border px-2 py-0.5 font-label text-[10px] font-semibold uppercase tracking-widest ${getCourseStatusStyles(course.status)}`}
              >
                {course.status}
              </span>
            </div>
            <p className="mt-1 font-body text-sm text-midnight/45">
              Mã: <span className="font-mono font-semibold text-gold">{course.code}</span> · Khung: {syllabus.name}
            </p>
          </div>
        </div>
        <div className="text-center md:text-right">
          <p className="mb-1 font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">
            Tiến độ khóa
          </p>
          <div className="flex items-center justify-center gap-3 md:justify-end">
            <div className="h-2 w-32 overflow-hidden rounded-full bg-midnight/10">
              <div className="h-full bg-gold transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-body text-sm font-semibold text-gold">{progress}%</span>
          </div>
        </div>
      </Card>

      <nav className="flex gap-6 border-b border-midnight/15 px-2">
        <TabItem active={activeTab === 'info'} label="Thông tin & học viên" onClick={() => setActiveTab('info')} />
        <TabItem active={activeTab === 'log'} label="Nhật ký & điểm danh" onClick={() => setActiveTab('log')} />
        <TabItem active={activeTab === 'progress'} label="Unit progress" onClick={() => setActiveTab('progress')} />
      </nav>

      <main>
        {activeTab === 'info' && (
          <div className="grid animate-fade-in grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-1">
              <Card className="space-y-4 p-6 shadow-md">
                <h3 className="border-b border-midnight/10 pb-2 font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">
                  Thông số vận hành
                </h3>
                <DetailRow label="Ngày khai giảng" value={course.openingDate} />
                <DetailRow label="Thời lượng" value={`${course.duration} buổi / ${course.totalHours} giờ`} />
                <DetailRow label="Lịch học" value={course.schedule || 'Chưa thiết lập'} isList />
              </Card>
              <Card className="space-y-4 bg-midnight p-6 text-white shadow-xl">
                <h3 className="font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Nhân sự phụ trách
                </h3>
                <FacultyRow label="GV Việt Nam" name={course.teacherVN} />
                <FacultyRow label="GV bản ngữ" name={course.teacherForeign} />
                <FacultyRow label="Trợ giảng" name={course.teachingAssistant} />
              </Card>
            </div>
            <Card className="overflow-hidden p-0 shadow-md lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-midnight/10 bg-bg/80 p-6">
                <h3 className="font-label font-semibold uppercase tracking-tight text-midnight">
                  Danh sách lớp ({students.length})
                </h3>
                <Button type="button" className="text-[10px]">
                  Thêm học viên (mock)
                </Button>
              </div>
              <StudentTable students={students} />
            </Card>
          </div>
        )}

        {activeTab === 'log' && (
          <Card className="flex animate-fade-in flex-col overflow-hidden p-0 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-midnight p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gold p-2 text-midnight">{getIcon('History', 20)}</div>
                <h3 className="font-label text-lg font-semibold uppercase tracking-tight">Nhật ký giảng dạy</h3>
              </div>
              <Button
                type="button"
                className="gap-2 bg-gold text-midnight hover:brightness-110"
                onClick={() => {
                  setIsAddingLesson(true);
                  setEditingLesson({});
                }}
              >
                {getIcon('Plus', 14)} Thêm buổi học
              </Button>
            </div>
            <LogTable
              lessons={courseLessons}
              onAttendance={setAttendanceLesson}
              onFeedback={setFeedbackLesson}
              onEdit={(l) => {
                setIsAddingLesson(false);
                setEditingLesson(l);
              }}
            />
          </Card>
        )}

        {activeTab === 'progress' && <StudentProgressCheck students={students} syllabus={syllabus} />}
      </main>

      <LessonDetailModal
        lesson={editingLesson}
        isOpen={editingLesson !== null}
        isAdding={isAddingLesson}
        onClose={() => {
          setEditingLesson(null);
          setIsAddingLesson(false);
        }}
        onSave={handleUpdateLesson}
      />

      <AttendanceModal
        lesson={attendanceLesson}
        students={attendanceStudents}
        isOpen={!!attendanceLesson}
        onClose={() => setAttendanceLesson(null)}
        onSave={handleAttendanceSave}
      />

      <ClassFeedbackModal
        key={feedbackLesson?.id ?? 'closed'}
        isOpen={!!feedbackLesson}
        lesson={feedbackLesson}
        courseName={course.name}
        totalStudents={students.length}
        onClose={() => setFeedbackLesson(null)}
        onCopySuccess={() =>
          setMessage({
            code: 'FB-COPY',
            text: 'Đã sao chép nội dung feedback vào clipboard.',
            type: 'success',
          })
        }
        onSend={({ fullText, remark }) => {
          const id = feedbackLesson?.id;
          if (id) {
            setCourseLessons((prev) => prev.map((l) => (l.id === id ? { ...l, lessonFeedback: remark } : l)));
          }
          setFeedbackLesson(null);
          setMessage({
            code: 'FB-200',
            text: fullText.trim() ? 'Đã gửi feedback (mock) — đã lưu nhận xét lên buổi học.' : 'Nội dung trống — chỉ đóng.',
            type: 'success',
          });
        }}
      />
    </div>
  );
};

const TabItem: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({
  active,
  label,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative pb-4 font-label text-xs font-semibold uppercase tracking-widest transition-colors ${
      active ? 'text-gold' : 'text-midnight/40 hover:text-midnight/65'
    }`}
  >
    {label}
    {active && <div className="absolute bottom-0 left-0 h-1 w-full rounded-t-full bg-gold" />}
  </button>
);

const DetailRow: React.FC<{ label: string; value: string; isList?: boolean }> = ({ label, value, isList }) => (
  <div>
    <p className="font-label text-[10px] font-semibold uppercase tracking-widest text-midnight/40">{label}</p>
    {isList ? (
      <div className="mt-1 space-y-1">
        {value.split('; ').map((v, i) => (
          <p key={i} className="font-body text-sm font-semibold text-midnight">
            {v}
          </p>
        ))}
      </div>
    ) : (
      <p className="mt-0.5 font-body text-sm font-semibold text-midnight">{value}</p>
    )}
  </div>
);

const FacultyRow: React.FC<{ label: string; name?: string }> = ({ label, name }) => (
  <div className="flex items-center gap-3">
    <div className="rounded-lg bg-white/10 p-2 text-gold">{getIcon('UserCheck', 16)}</div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-label text-[9px] font-semibold uppercase text-white/50">{label}</p>
      <p className="truncate font-body text-xs font-semibold text-white">{name?.trim() || 'Chưa phân công'}</p>
    </div>
  </div>
);

const StudentTable: React.FC<{ students: CourseRosterStudent[] }> = ({ students }) => (
  <table className="w-full border-collapse text-left">
    <thead className="bg-midnight/5">
      <tr className="font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
        <th className="px-6 py-3">Mã HV</th>
        <th className="px-6 py-3">Họ tên</th>
        <th className="px-6 py-3">Trạng thái</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-midnight/5">
      {students.map((s) => (
        <tr key={s.id} className="transition-colors hover:bg-midnight/[0.02]">
          <td className="px-6 py-4 font-mono text-xs font-semibold text-gold">{s.studentCode}</td>
          <td className="px-6 py-4 font-body text-sm font-semibold text-midnight">{s.studentName}</td>
          <td className="px-6 py-4">
            <span
              className={`rounded-full border px-2 py-0.5 font-label text-[10px] font-semibold ${getCourseStatusStyles(s.status)}`}
            >
              {s.status}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const LogTable: React.FC<{
  lessons: CourseLesson[];
  onAttendance: (l: CourseLesson) => void;
  onFeedback: (l: CourseLesson) => void;
  onEdit: (l: CourseLesson) => void;
}> = ({ lessons, onAttendance, onFeedback, onEdit }) => (
  <div className="overflow-x-auto">
    <table className="min-w-[960px] w-full table-fixed border-collapse text-left">
      <thead className="border-b border-midnight/10 bg-midnight/5">
        <tr className="font-label text-[10px] font-semibold uppercase text-gold">
          <th className="w-14 px-3 py-4 text-center">STT</th>
          <th className="w-32 px-3 py-4">Trạng thái</th>
          <th className="w-28 px-3 py-4 text-center">Điểm danh</th>
          <th className="w-32 px-3 py-4">Ngày dạy</th>
          <th className="w-36 px-3 py-4">Giáo viên</th>
          <th className="px-3 py-4">Nội dung</th>
          <th className="w-36 px-3 py-4">BTVN</th>
          <th className="w-24 px-3 py-4 text-center">Feedback</th>
          <th className="w-20 px-3 py-4 text-right pr-6">Sửa</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-midnight/5 font-body text-xs">
        {lessons.map((l) => (
          <tr
            key={l.id}
            className={`${l.executionStatus === 'Huỷ' ? 'bg-error-bg/20' : ''} transition-colors hover:bg-midnight/[0.02]`}
          >
            <td className="px-3 py-4 text-center">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-semibold ${
                  l.executionStatus === 'Huỷ' ? 'bg-error text-white' : 'bg-midnight text-white'
                }`}
              >
                {l.stt || '—'}
              </span>
            </td>
            <td className="px-3 py-4">
              <span
                className={`rounded-lg border px-2 py-1 font-label text-[9px] font-semibold uppercase ${getLessonExecutionStyles(l.executionStatus)}`}
              >
                {l.executionStatus}
              </span>
            </td>
            <td className="px-3 py-4 text-center">
              <Button
                type="button"
                variant="ghost"
                className="border border-gold/35 text-[9px] text-gold hover:bg-gold hover:text-midnight"
                onClick={() => onAttendance(l)}
              >
                Ghi nhận
              </Button>
            </td>
            <td className="px-3 py-4 font-semibold text-midnight">{l.teachingDate || '—'}</td>
            <td className="px-3 py-4 font-semibold text-midnight">{l.teacherName || '—'}</td>
            <td className="line-clamp-2 px-3 py-4 text-midnight/85">{l.content}</td>
            <td className="px-3 py-4 font-semibold text-warning">{l.homework || '—'}</td>
            <td className="px-3 py-4 text-center">
              <button
                type="button"
                onClick={() => onFeedback(l)}
                className="rounded-lg border border-info/25 bg-info-bg p-1.5 text-info transition-colors hover:bg-info hover:text-white"
                title="Feedback"
              >
                <MessageSquare size={16} strokeWidth={2} aria-hidden />
              </button>
            </td>
            <td className="px-3 py-4 pr-6 text-right">
              <button
                type="button"
                onClick={() => onEdit(l)}
                className="rounded-lg p-2 text-midnight/40 transition-colors hover:bg-gold/10 hover:text-gold"
                title="Sửa buổi"
              >
                {getIcon('Edit', 18)}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default CourseDetail;
