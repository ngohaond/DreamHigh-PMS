import { UnprocessableEntityException } from '@nestjs/common';

export type ScheduleConflictDetail = {
  /** 'TEACHER' | 'ROOM' */
  resourceType: 'TEACHER' | 'ROOM';
  /** Tên giáo viên hoặc phòng bị xung đột. */
  resourceName: string;
  /** Mã lớp đang chiếm khung giờ. */
  classCode: string;
  /** Khoảng giờ của buổi đang xung đột. */
  conflictStartTime: Date;
  conflictEndTime: Date;
  /** Id của buổi học bị xung đột (nếu có). */
  conflictSessionId?: number;
  /** Khoảng giờ đang được đề xuất. */
  requestedStartTime: Date;
  requestedEndTime: Date;
};

export class ScheduleConflictException extends UnprocessableEntityException {
  constructor(detail: ScheduleConflictDetail) {
    const target =
      detail.resourceType === 'TEACHER'
        ? `Giáo viên ${detail.resourceName}`
        : `Phòng ${detail.resourceName}`;
    super({
      statusCode: 422,
      error: 'SCHEDULE_CONFLICT',
      message: `${target} đã có lịch dạy với lớp ${detail.classCode} trong khung giờ này.`,
      data: {
        ...detail,
        conflictStartTime: detail.conflictStartTime.toISOString(),
        conflictEndTime: detail.conflictEndTime.toISOString(),
        requestedStartTime: detail.requestedStartTime.toISOString(),
        requestedEndTime: detail.requestedEndTime.toISOString(),
      },
    });
  }
}
