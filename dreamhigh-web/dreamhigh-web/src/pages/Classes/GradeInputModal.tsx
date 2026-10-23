import React, { useState, useId, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { submitBulkGrades } from '../../services/phaseCApi';
import type { Exam, GradeRecord } from '../../types/phaseC';

export interface GradeInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  students: Array<{ id: number; fullName: string; studentCode: string }>;
  existingGrades?: Array<{ studentId: number; score: number; remarks?: string }>;
}

export const GradeInputModal: React.FC<GradeInputModalProps> = ({
  isOpen,
  onClose,
  exam,
  students,
  existingGrades = [],
}) => {
  const titleId = useId();
  const queryClient = useQueryClient();

  const [grades, setGrades] = useState<Record<number, { score: string; remarks: string }>>(() => {
    const initial: Record<number, { score: string; remarks: string }> = {};
    students.forEach((s) => {
      const existing = existingGrades.find((g) => g.studentId === s.id);
      initial[s.id] = {
        score: existing?.score?.toString() || '',
        remarks: existing?.remarks || '',
      };
    });
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (gradeRecords: GradeRecord[]) => {
      if (!exam) throw new Error('No exam selected');
      return submitBulkGrades(exam.id, { grades: gradeRecords });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['class-exams', exam?.classId] });

      // Show low score alerts if any
      if (response.data.lowScoreAlerts && response.data.lowScoreAlerts.length > 0) {
        const alertMessages = response.data.lowScoreAlerts.map(
          (alert) => `Học viên ID ${alert.studentId}: ${alert.score} điểm`
        );
        alert(
          `Cảnh báo: Có ${response.data.lowScoreAlerts.length} học viên đạt điểm thấp (< 50% điểm tối đa):\n\n${alertMessages.join('\n')}`
        );
      }

      onClose();
    },
    onError: (error) => {
      console.error('Failed to submit grades:', error);
      alert('Không thể lưu điểm. Vui lòng thử lại.');
    },
  });

  // Reset grades when modal opens with new exam
  useEffect(() => {
    if (isOpen && exam) {
      const initial: Record<number, { score: string; remarks: string }> = {};
      students.forEach((s) => {
        const existing = existingGrades.find((g) => g.studentId === s.id);
        initial[s.id] = {
          score: existing?.score?.toString() || '',
          remarks: existing?.remarks || '',
        };
      });
      setGrades(initial);
    }
  }, [isOpen, exam, students, existingGrades]);

  if (!isOpen || !exam) return null;

  const updateScore = (studentId: number, score: string) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], score },
    }));
  };

  const updateRemarks = (studentId: number, remarks: string) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks },
    }));
  };

  const handleSave = () => {
    const gradeRecords: GradeRecord[] = students
      .map((s) => {
        const g = grades[s.id];
        const score = parseFloat(g.score);
        if (isNaN(score)) return null;

        // Validate score range
        if (score < 0 || score > exam.maxScore) {
          alert(`Điểm của ${s.fullName} phải từ 0 đến ${exam.maxScore}`);
          return null;
        }

        return {
          studentId: s.id,
          score,
          remarks: g.remarks.trim() || undefined,
        };
      })
      .filter((g): g is GradeRecord => g !== null);

    if (gradeRecords.length === 0) {
      alert('Vui lòng nhập ít nhất một điểm hợp lệ');
      return;
    }

    mutation.mutate(gradeRecords);
  };

  const filledCount = students.filter((s) => {
    const score = parseFloat(grades[s.id]?.score || '');
    return !isNaN(score) && score >= 0 && score <= exam.maxScore;
  }).length;

  const avgScore =
    filledCount > 0
      ? students.reduce((sum, s) => {
          const score = parseFloat(grades[s.id]?.score || '0');
          return sum + (isNaN(score) ? 0 : score);
        }, 0) / filledCount
      : 0;

  return (
    <div
      className="custom-scrollbar fixed inset-0 z-[100] flex items-center justify-center bg-midnight/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden p-0 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between bg-midnight px-6 py-6">
          <div>
            <h2 id={titleId} className="font-label text-xl font-semibold uppercase tracking-tight text-white">
              Nhập điểm
            </h2>
            <p className="mt-1 font-body text-xs font-semibold text-gold">
              {exam.title} · Điểm tối đa: {exam.maxScore}
              {exam.weightPercent !== undefined && ` · Trọng số: ${exam.weightPercent}%`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Đóng"
          >
            <X size={24} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 border-b border-midnight/10 bg-midnight/5 px-6 py-4">
          <div>
            <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
              Đã nhập
            </span>
            <p className="font-headline italic text-2xl text-midnight">
              {filledCount}/{students.length}
            </p>
          </div>
          <div>
            <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
              Điểm trung bình
            </span>
            <p className="font-headline italic text-2xl text-midnight">
              {avgScore.toFixed(1)}
            </p>
          </div>
          <div>
            <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
              Ngày thi
            </span>
            <p className="text-sm text-midnight/80">
              {new Date(exam.scheduledAt).toLocaleDateString('vi-VN')}
            </p>
          </div>
        </div>

        {/* Grades Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b-2 border-midnight/20">
                <th className="pb-3 text-left font-label text-xs uppercase tracking-widest text-midnight/60">
                  Mã HV
                </th>
                <th className="pb-3 text-left font-label text-xs uppercase tracking-widest text-midnight/60">
                  Họ tên
                </th>
                <th className="w-32 pb-3 text-left font-label text-xs uppercase tracking-widest text-midnight/60">
                  Điểm
                </th>
                <th className="pb-3 text-left font-label text-xs uppercase tracking-widest text-midnight/60">
                  Ghi chú
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const score = parseFloat(grades[student.id]?.score || '');
                const isValid = !isNaN(score) && score >= 0 && score <= exam.maxScore;
                const isLowScore = isValid && score < exam.maxScore * 0.5;

                return (
                  <tr key={student.id} className="border-b border-midnight/5">
                    <td className="py-3 font-label text-xs tracking-widest text-midnight/60">
                      {student.studentCode}
                    </td>
                    <td className="py-3 text-midnight">{student.fullName}</td>
                    <td className="py-3">
                      <input
                        type="number"
                        min={0}
                        max={exam.maxScore}
                        step={0.5}
                        value={grades[student.id]?.score || ''}
                        onChange={(e) => updateScore(student.id, e.target.value)}
                        className={`w-full rounded-md border px-3 py-2 text-center font-headline italic text-lg transition-all focus:outline-none focus:ring-2 ${
                          isLowScore
                            ? 'border-error/30 bg-error/5 text-error focus:ring-error/30'
                            : isValid
                            ? 'border-success/30 bg-success/5 text-success focus:ring-success/30'
                            : 'border-midnight/20 bg-white text-midnight focus:ring-gold/30'
                        }`}
                        placeholder="0"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="text"
                        value={grades[student.id]?.remarks || ''}
                        onChange={(e) => updateRemarks(student.id, e.target.value)}
                        className="w-full rounded-md border border-midnight/20 bg-white px-3 py-2 text-sm transition-all focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20"
                        placeholder="Ghi chú (tùy chọn)"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-midnight/10 bg-midnight/5 px-6 py-4">
          <p className="text-xs text-midnight/40">
            Điểm dưới 50% ({exam.maxScore * 0.5}) sẽ được đánh dấu cảnh báo
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : `Lưu điểm (${filledCount})`}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
