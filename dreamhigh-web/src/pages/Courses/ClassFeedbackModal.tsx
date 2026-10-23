import React, { useId, useState } from 'react';
import { Copy, Info, Send, X } from 'lucide-react';
import { Button } from '../../design-system/components/ui/Button';
import { Card } from '../../design-system/components/ui/Card';
import { TextArea } from '../../design-system/components/ui/Input';
import type { CourseLesson } from '../../types/course';

export interface ClassFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: CourseLesson | null;
  courseName: string;
  totalStudents: number;
  /** fullText: nội dung gửi; remark: phần nhận xét lưu lại trên buổi học */
  onSend: (payload: { fullText: string; remark: string }) => void;
  onCopySuccess?: () => void;
}

const ClassFeedbackModal: React.FC<ClassFeedbackModalProps> = ({
  isOpen,
  onClose,
  lesson,
  courseName,
  totalStudents,
  onSend,
  onCopySuccess,
}) => {
  const titleId = useId();
  const [remark, setRemark] = useState(() => lesson?.lessonFeedback || '');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !lesson) return null;

  const attendedCount = lesson.attendance?.filter((a) => a.status === 'Attended').length || 0;

  const generateFeedbackText = () => {
    return `${courseName} _ ${lesson.teachingDate || 'Chưa cập nhật'}
Sĩ số: ${attendedCount}/${totalStudents}
Nội dung bài học: ${lesson.content || '---'}
Nhận xét học sinh/buổi học: ${remark || 'Lớp học tập trung, hoàn thành tốt các hoạt động.'}
BTVN: ${lesson.homework || 'Xem chi tiết trên ứng dụng.'}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateFeedbackText());
      onCopySuccess?.();
    } catch {
      /* Clipboard API không khả dụng (mock / HTTP). */
    }
  };

  const handleSend = () => {
    setIsSending(true);
    window.setTimeout(() => {
      onSend({ fullText: generateFeedbackText(), remark });
      setIsSending(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      className="custom-scrollbar fixed inset-0 z-[100] flex items-center justify-center bg-midnight/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0 shadow-xl animate-fade-in">
        <div className="relative overflow-hidden border-b border-midnight/10 bg-midnight px-8 py-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gold/15 blur-2xl" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-label text-lg font-semibold uppercase tracking-tight text-white md:text-xl">
                Class feedback builder
              </h2>
              <p className="mt-1 font-label text-[10px] font-semibold uppercase tracking-widest text-gold">
                Gửi thông báo kết quả buổi học
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="relative z-10 rounded-full bg-white/10 p-2 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Đóng"
            >
              <X size={24} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-8">
          <div className="flex items-start gap-3 rounded-2xl border border-info/25 bg-info-bg p-4">
            <span className="mt-0.5 shrink-0 text-info">
              <Info size={18} strokeWidth={2} aria-hidden />
            </span>
            <p className="font-label text-[11px] font-semibold uppercase leading-relaxed text-info">
              Nội dung dưới đây sẽ được gửi đến app phụ huynh và kênh Zalo OA (mock — chưa nối API).
            </p>
          </div>

          <div className="space-y-4">
            <TextArea
              label="Nhận xét buổi học (có thể chỉnh sửa)"
              rows={4}
              placeholder="Nhận xét chung cho lớp hoặc lưu ý đặc biệt…"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
            <div className="space-y-2">
              <span className="input-label">Xem trước (preview)</span>
              <pre className="whitespace-pre-wrap rounded-3xl border border-midnight/20 bg-midnight p-6 font-mono text-xs leading-relaxed text-gold shadow-inner">
                {generateFeedbackText()}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-midnight/10 bg-bg p-8">
          <Button type="button" variant="secondary" className="gap-2 px-6 py-4" onClick={() => void copyToClipboard()}>
            <Copy size={18} strokeWidth={2} aria-hidden />
            Copy
          </Button>
          <Button
            type="button"
            className="min-w-[200px] flex-1 gap-3 py-4 shadow-md disabled:opacity-70"
            disabled={isSending}
            onClick={handleSend}
          >
            {isSending ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden
                />
                Đang gửi…
              </>
            ) : (
              <>
                <Send size={18} strokeWidth={2} aria-hidden />
                Gửi feedback cho phụ huynh
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ClassFeedbackModal;
