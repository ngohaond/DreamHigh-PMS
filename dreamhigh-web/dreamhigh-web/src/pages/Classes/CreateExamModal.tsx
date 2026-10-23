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
  classCode: string;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({ isOpen, onClose, classCode }) => {
  const titleId = useId();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateExamRequest>({
    classCode,
    examName: '',
    examType: 'QUIZ',
    maxScore: 10,
    weight: 10,
    examDate: undefined,
  });

  const mutation = useMutation({
    mutationFn: createExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-exams', classCode] });
      onClose();
      setFormData({
        classCode,
        examName: '',
        examType: 'QUIZ',
        maxScore: 10,
        weight: 10,
        examDate: undefined,
      });
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.examName.trim()) {
      alert('Vui lòng nhập tên đợt đánh giá');
      return;
    }
    mutation.mutate(formData);
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
              value={formData.examName}
              onChange={(e) => setFormData({ ...formData, examName: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="input-label">Loại đánh giá</label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {examTypeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, examType: opt.value })}
                  className={`p-4 rounded-xl border-2 transition-all font-label uppercase text-xs tracking-wider ${
                    formData.examType === opt.value
                      ? 'border-gold bg-gold/5 text-midnight'
                      : 'border-midnight/10 bg-white hover:border-gold/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                type="number"
                label="Điểm tối đa"
                placeholder="10"
                min="1"
                max="100"
                value={formData.maxScore}
                onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <Input
                type="number"
                label="Trọng số (%)"
                placeholder="10"
                min="0"
                max="100"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div>
            <Input
              type="date"
              label="Ngày thi (tuỳ chọn)"
              value={formData.examDate || ''}
              onChange={(e) => setFormData({ ...formData, examDate: e.target.value || undefined })}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-midnight/10">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={mutation.isPending}>
              Huỷ
            </Button>
            <Button type="submit" className="flex-1 shadow-md" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo đợt đánh giá'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
