import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AttendanceModal, { AttendanceModalProps } from './AttendanceModal';
import { submitBulkAttendance } from '../../services/phaseCApi';
import type { AttendanceRecord } from '../../types/attendance';
import type { BulkAttendanceRecord } from '../../types/phaseC';

interface AttendanceModalWithAPIProps extends Omit<AttendanceModalProps, 'onSave'> {
  sessionId: string;
  classCode: string;
  onSaveSuccess?: () => void;
}

/**
 * Wrapper component that connects AttendanceModal to Phase C API
 */
export const AttendanceModalWithAPI: React.FC<AttendanceModalWithAPIProps> = ({
  sessionId,
  classCode,
  onSaveSuccess,
  ...modalProps
}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (records: AttendanceRecord[]) => {
      // Map from UI format to API format
      const apiRecords: BulkAttendanceRecord[] = records.map((r) => ({
        studentId: r.studentId,
        status: r.status === 'Attended' ? 'PRESENT' : 'ABSENT',
        note: r.note || undefined,
      }));

      return submitBulkAttendance({
        sessionId,
        classCode,
        records: apiRecords,
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['class', classCode] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classCode] });
      onSaveSuccess?.();
    },
    onError: (error) => {
      console.error('Failed to save attendance:', error);
      alert('Không thể lưu điểm danh. Vui lòng thử lại.');
    },
  });

  const handleSave = (records: AttendanceRecord[]) => {
    mutation.mutate(records);
  };

  return <AttendanceModal {...modalProps} onSave={handleSave} />;
};
