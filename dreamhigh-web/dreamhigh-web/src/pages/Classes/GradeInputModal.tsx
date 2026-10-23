import React, { useState, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { submitBulkGrades } from '../../services/phaseCApi';
import type { Exam, GradeRecord } from '../../types/phaseC';

export interface GradeInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  students: Array<{ id: string; fullName: string; studentCode: string }>;
  existingGrades?: Array<{ studentId: string; score: number; feedback?: string }>;
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

  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>(() => {
    const initial: Record<string, { score: string; feedback: string }> = {};
    students.forEach((s) => {
      const existing = existingGrades.find((g) => g.studentId === s.id);
      initial[s.id] = {
        score: existing?.score?.toString() || '',
        feedback: existing?.feedback || '',
      };
    });
    return initial;
  });

  const mutation = useMutation({
    mutationFn: (gradeRecords: GradeRecord[]) => {
      if (!exam) throw new Error('No exam selected');
      return submitBulkGrades(exam.id, { examId: exam.id, grades: gradeRecords });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-exams', exam?.classCode] });
      onClose();
    },
  });

  if (!isOpen || !exam) return null;

  const updateScore = (studentId: string, score: string) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], score },
    }));
  };

  const updateFeedback = (studentId: string, feedback: string) => {
    setGrades((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], feedback },
    }));
  };

  const handleSave = () => {
    const gradeRecords: GradeRecord[] = students
      .map((s) => {
        const g = grades[s.id];
        const score = parseFloat(g.score);
        if (isNaN(score)) return null;
        return {
          studentId: s.id,
          score,
          feedback: g.feedback.trim() || undefined,
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
    return !isNaN(score);
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
              {exam.examName} · Điểm tối đa: {exam.maxScore}
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

        <div className="grid grid-cols-3 gap-3 border-b border-midnight/10 bg-bg p-4 sm:gap-4 sm:p-6">
          <StatBox label="Đã nhập điểm" value={filledCount} total={students.length} variant="info" />
          <StatBox label="Điểm trung bình" value={avgScore.toFixed(1)} variant="success" />
          <StatBox label="Trọng số" value={`${exam.weight}%`} variant="warning" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-midnight/10">
                <th className="w-12 px-3 py-3 text-center font-label text-[10px] font-semibold uppercase tracking-widest text-gold sm:px-4">
                  STT
                </th>
                <th className="px-3 py-3 font-label text-[10px] font-semibold uppercase tracking-widest text-gold sm:px-4">
                  Học viên
                </th>
                <th className="w-32 px-3 py-3 font-label text-[10px] font-semibold uppercase tracking-widest text-gold sm:px-4">
                  Điểm
                </th>
                <th className="px-3 py-3 font-label text-[10px] font-semibold uppercase tracking-widest text-gold sm:px-4">
                  Nhận xét
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-midnight/5">
              {students.map((student, index) => {
                const g = grades[student.id];
                const score = parseFloat(g.score);
                const isValid = !isNaN(score) && score >= 0 && score <= exam.maxScore;
                const showWarning = g.score !== '' && !isValid;

                return (
                  <tr key={student.id} className="transition-colors hover:bg-midnight/[0.02]">
                    <td className="px-3 py-4 text-center font-body text-xs font-semibold text-midnight/40 sm:px-4">
                      {index + 1}
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <p className="font-body text-sm font-semibold text-midnight">{student.fullName}</p>
                      <p className="font-mono text-[10px] text-midnight/40">{student.studentCode}</p>
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max={exam.maxScore}
                        className={`input-field h-10 w-full text-center font-semibold ${
                          showWarning ? 'border-error focus:border-error' : ''
                        }`}
                        placeholder="—"
                        value={g.score}
                        onChange={(e) => updateScore(student.id, e.target.value)}
                      />
                      {showWarning && (
                        <p className="text-[9px] text-error mt-1">0-{exam.maxScore}</p>
                      )}
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <input
                        type="text"
                        className="input-field h-10 text-xs"
                        placeholder="Nhận xét…"
                        value={g.feedback}
                        onChange={(e) => updateFeedback(student.id, e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 border-t border-midnight/10 bg-bg p-6">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={mutation.isPending}>
            Huỷ
          </Button>
          <Button
            type="button"
            className="flex-1 shadow-md"
            onClick={handleSave}
            disabled={mutation.isPending || filledCount === 0}
          >
            {mutation.isPending ? 'Đang lưu...' : `Lưu điểm (${filledCount})`}
          </Button>
        </div>
      </Card>
    </div>
  );
};

type StatVariant = 'success' | 'error' | 'info' | 'warning';

const statStyles: Record<StatVariant, { box: string; value: string; label: string }> = {
  success: {
    box: 'border-success/20 bg-success-bg',
    value: 'text-success',
    label: 'text-midnight/50',
  },
  error: {
    box: 'border-error/20 bg-error-bg',
    value: 'text-error',
    label: 'text-midnight/50',
  },
  info: {
    box: 'border-info/20 bg-info-bg',
    value: 'text-info',
    label: 'text-midnight/50',
  },
  warning: {
    box: 'border-warning/20 bg-warning-bg',
    value: 'text-warning',
    label: 'text-midnight/50',
  },
};

const StatBox: React.FC<{ label: string; value: string | number; total?: number; variant: StatVariant }> = ({
  label,
  value,
  total,
  variant,
}) => {
  const s = statStyles[variant];
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border p-3 shadow-sm ${s.box}`}>
      <span className={`font-body text-xl font-semibold ${s.value}`}>
        {value}
        {total !== undefined && <span className="text-sm text-midnight/30 ml-1">/ {total}</span>}
      </span>
      <span
        className={`mt-1 text-center font-label text-[9px] font-semibold uppercase tracking-tighter ${s.label}`}
      >
        {label}
      </span>
    </div>
  );
};
