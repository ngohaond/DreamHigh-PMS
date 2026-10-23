import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { getClassExams } from '../../services/phaseCApi';
import type { Exam } from '../../types/phaseC';

interface ResultsTabProps {
  classCode: string;
  onCreateExam: () => void;
  onViewExam: (exam: Exam) => void;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ classCode, onCreateExam, onViewExam }) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['class-exams', classCode],
    queryFn: () => getClassExams(classCode),
    enabled: !!classCode,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 animate-pulse text-midnight/20 font-label uppercase tracking-widest">
        Đang tải dữ liệu kết quả...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-error">
        <span className="material-symbols-outlined text-6xl mb-4">error_outline</span>
        <p className="font-headline italic text-xl mb-4">Không thể tải dữ liệu kết quả</p>
        <Button variant="primary" onClick={() => refetch()}>Thử lại</Button>
      </div>
    );
  }

  const exams = data?.exams || [];

  const examTypeLabels: Record<Exam['examType'], string> = {
    MIDTERM: 'Giữa kỳ',
    FINAL: 'Cuối kỳ',
    QUIZ: 'Kiểm tra',
    ASSIGNMENT: 'Bài tập',
  };

  const examTypeBadgeColors: Record<Exam['examType'], string> = {
    MIDTERM: 'bg-warning/10 text-warning border-warning/20',
    FINAL: 'bg-error/10 text-error border-error/20',
    QUIZ: 'bg-info/10 text-info border-info/20',
    ASSIGNMENT: 'bg-success/10 text-success border-success/20',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-label uppercase tracking-ultra text-[10px] text-gold mb-2">Kết quả học tập</h2>
          <p className="text-sm text-midnight/60">Quản lý đánh giá và điểm số của lớp học</p>
        </div>
        <Button onClick={onCreateExam} className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base">add</span>
          Tạo đợt đánh giá
        </Button>
      </div>

      {/* Exams Grid */}
      {exams.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-6xl text-midnight/10 mb-4">
            assignment
          </span>
          <p className="font-headline italic text-xl text-midnight/20 mb-2">
            Chưa có đợt đánh giá nào
          </p>
          <p className="text-sm text-midnight/40 mb-6">
            Tạo đợt đánh giá đầu tiên để bắt đầu nhập điểm cho học viên
          </p>
          <Button onClick={onCreateExam} variant="primary" className="px-8">
            Tạo đợt đánh giá mới
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {exams.map((exam) => {
            const gradedCount = exam.grades?.length || 0;
            const badgeColor = examTypeBadgeColors[exam.examType];

            return (
              <Card
                key={exam.id}
                className="p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-gold/30"
                onClick={() => onViewExam(exam)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-headline italic text-2xl text-midnight">
                        {exam.examName}
                      </h3>
                      <span
                        className={`font-label uppercase text-[9px] tracking-widest px-3 py-1 rounded-full border ${badgeColor}`}
                      >
                        {examTypeLabels[exam.examType]}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-6 mt-4">
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Điểm tối đa
                        </span>
                        <p className="font-body text-lg font-semibold text-midnight mt-1">
                          {exam.maxScore}
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Trọng số
                        </span>
                        <p className="font-body text-lg font-semibold text-midnight mt-1">
                          {exam.weight}%
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Ngày thi
                        </span>
                        <p className="font-body text-sm text-midnight mt-1">
                          {exam.examDate
                            ? new Date(exam.examDate).toLocaleDateString('vi-VN')
                            : 'Chưa xác định'}
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[9px] tracking-widest text-midnight/40">
                          Đã nhập điểm
                        </span>
                        <p className="font-body text-lg font-semibold text-gold mt-1">
                          {gradedCount} học viên
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    className="p-3 rounded-xl bg-midnight/5 hover:bg-gold/10 transition-colors text-midnight/40 hover:text-gold"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewExam(exam);
                    }}
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
