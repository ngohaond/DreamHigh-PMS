import React, { useState, useId } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { Input } from '../../design-system/components/ui/Input';
import { createExam } from '../../services/phaseCApi';
import type { CreateExamRequest } from '../../types/phaseC';

export interface CreateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: number; // Changed from classCode
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({ isOpen, onClose, classId }) => {
  const titleId = useId();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateExamRequest>({
    classId,
    title: '',
    examType: 'QUIZ',
    maxScore: 10,
    weightPercent: 10,
    scheduledAt: '', // ISO 8601 required
  });

  const mutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-exams', classId] });
      onClose();
      setFormData({
        classId,
        title: '',
        examType: 'QUIZ',
        maxScore: 10,
        weightPercent: 10,
        scheduledAt: '',
      });
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Vui lòng nhập tên đợt đánh giá');
      return;
    }
    if (!formData.scheduledAt) {
      alert('Vui lòng chọn ngày thi');
      return;
    }

    // Convert date input to ISO 8601
    const scheduledAt = new Date(formData.scheduledAt).toISOString();

    mutation.mutate({
      ...formData,
      scheduledAt,
    });
  };

  const examTypeOptions = [
    { value: 'QUIZ', label: 'Kiểm tra' },
    { value: 'ASSIGNMENT', label: 'Bài tập' },
    { value: 'MIDTERM', label: 'Giữa kỳ' },
    { value: 'FINAL', label: 'Cuối kỳ' },
  ] as const;

  return (
    <div
      className="custom-scrollbar fixed inset-0 z-[100] flex items-center justify-center bg-midnight/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0 shadow-xl animate-fade-in">
        <div className="flex items-center justify-between bg-midnight px-6 py-6">
          <div>
            <h2 id={titleId} className="font-label text-xl font-semibold uppercase tracking-tight text-white">
              Tạo đợt đánh giá mới
            </h2>
            <p className="mt-1 font-body text-xs font-semibold text-gold">
              Thêm kỳ thi hoặc bài kiểm tra cho lớp học
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

        <form onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <Input
              label="Tên đợt đánh giá"
              placeholder="Ví dụ: Kiểm tra Unit 1-3"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="mb-2 block font-label text-xs uppercase tracking-widest text-midnight/60">
              Loại đánh giá
            </label>
            <div className="grid grid-cols-4 gap-3">
              {examTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, examType: option.value })}
                  className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                    formData.examType === option.value
                      ? 'border-gold bg-gold/10 text-midnight'
                      : 'border-midnight/10 bg-white text-midnight/60 hover:border-midnight/30'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Điểm tối đa"
                type="number"
                min={1}
                max={1000}
                value={formData.maxScore}
                onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) })}
                required
              />
            </div>
            <div>
              <Input
                label="Trọng số (%)"
                type="number"
                min={0}
                max={100}
                value={formData.weightPercent || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weightPercent: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="Tùy chọn"
              />
            </div>
          </div>

          <div>
            <Input
              label="Ngày thi"
              type="date"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              required
            />
            <p className="mt-1 text-xs text-midnight/40">Chọn ngày diễn ra đợt đánh giá</p>
          </div>

          <div className="flex justify-end gap-3 border-t border-midnight/10 pt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo đợt đánh giá'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
