import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AttendanceModal, { AttendanceModalProps } from './AttendanceModal';
import { submitBulkAttendance } from '../../services/phaseCApi';
import type { AttendanceRecord } from '../../types/attendance';
import type { BulkAttendanceRecord, AttendanceStatus } from '../../types/phaseC';

interface AttendanceModalWithAPIProps extends Omit<AttendanceModalProps, 'onSave'> {
  sessionId: number;
  classCode: string;
  onSaveSuccess?: () => void;
}

/**
 * Wrapper component that connects AttendanceModal to Phase C API
 * Maps UI format (Attended/Absent) to API format (PRESENT/ABSENT_UNEXCUSED)
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
      // Map from UI format to C1 API format
      const apiRecords: BulkAttendanceRecord[] = records.map((r) => {
        // UI has studentId as string, API needs number
        const studentId = typeof r.studentId === 'string' ? parseInt(r.studentId, 10) : r.studentId;

        // Map UI status to API status
        let status: AttendanceStatus = 'PRESENT';
        if (r.status === 'Absent') {
          // Default to ABSENT_UNEXCUSED; if note indicates excuse, use ABSENT_EXCUSED
          status = r.note?.toLowerCase().includes('phép') ? 'ABSENT_EXCUSED' : 'ABSENT_UNEXCUSED';
        }

        return {
          studentId,
          status,
          note: r.note || undefined,
        };
      });

      return submitBulkAttendance(sessionId, { attendances: apiRecords });
    },
    onSuccess: (response) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['class', classCode] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classCode] });
      console.log(`Đã điểm danh ${response.meta.total} học sinh`);
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
