import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** Dời lịch một buổi (tuỳ chọn dời tiếp các buổi sau). */
export class RescheduleSessionDto {
  /** Ngày mới theo giờ địa phương, định dạng YYYY-MM-DD. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date phải có định dạng YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime phải có định dạng HH:mm' })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime phải có định dạng HH:mm' })
  endTime?: string;

  /** Dời tiếp các buổi sau của cùng lớp theo cùng khoảng lệch. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  shiftFollowing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/** Đổi giáo viên thực dạy cho một buổi. */
export class ChangeSessionTeacherDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  teacherId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/** Đổi phòng học cho một buổi. */
export class ChangeSessionRoomDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/** Hủy một buổi học. */
export class CancelSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}
