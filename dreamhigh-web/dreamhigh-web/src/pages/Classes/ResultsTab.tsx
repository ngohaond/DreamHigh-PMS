import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { getClassExams } from '../../services/phaseCApi';
import type { Exam } from '../../types/phaseC';

interface ResultsTabProps {
  classId: number; // Changed from classCode
  onCreateExam: () => void;
  onViewExam: (exam: Exam) => void;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ classId, onCreateExam, onViewExam }) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['class-exams', classId],
    queryFn: () => getClassExams(classId),
    enabled: !!classId,
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

  const exams = data?.data || [];

  const getExamTypeLabel = (type?: string): string => {
    if (!type) return 'Khác';
    const labels: Record<string, string> = {
      MIDTERM: 'Giữa kỳ',
      FINAL: 'Cuối kỳ',
      QUIZ: 'Kiểm tra',
      ASSIGNMENT: 'Bài tập',
    };
    return labels[type.toUpperCase()] || type;
  };

  const getExamTypeBadgeColor = (type?: string): string => {
    if (!type) return 'bg-midnight/10 text-midnight/60 border-midnight/20';
    const colors: Record<string, string> = {
      MIDTERM: 'bg-warning/10 text-warning border-warning/20',
      FINAL: 'bg-error/10 text-error border-error/20',
      QUIZ: 'bg-info/10 text-info border-info/20',
      ASSIGNMENT: 'bg-success/10 text-success border-success/20',
    };
    return colors[type.toUpperCase()] || 'bg-midnight/10 text-midnight/60 border-midnight/20';
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
            const badgeColor = getExamTypeBadgeColor(exam.examType);

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
                        {exam.title}
                      </h3>
                      <span
                        className={`font-label text-xs tracking-widest px-3 py-1 rounded-full border ${badgeColor}`}
                      >
                        {getExamTypeLabel(exam.examType)}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-6 mt-4">
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Điểm tối đa
                        </span>
                        <p className="font-headline italic text-xl text-midnight">
                          {exam.maxScore}
                        </p>
                      </div>
                      {exam.weightPercent !== undefined && (
                        <div>
                          <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                            Trọng số
                          </span>
                          <p className="font-headline italic text-xl text-midnight">
                            {exam.weightPercent}%
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Ngày thi
                        </span>
                        <p className="text-sm text-midnight/80">
                          {new Date(exam.scheduledAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <div>
                        <span className="font-label uppercase text-[10px] tracking-widest text-midnight/40">
                          Tạo lúc
                        </span>
                        <p className="text-sm text-midnight/80">
                          {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col items-end">
                    <span className="material-symbols-outlined text-gold text-4xl">
                      chevron_right
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
