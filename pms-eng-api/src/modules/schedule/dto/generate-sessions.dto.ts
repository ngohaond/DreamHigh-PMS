import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

/** Quy tắc lặp dùng chung cho preview và generate sessions. */
export class ScheduleRuleDto {
  /** ISO weekday: 1 = Thứ 2 … 7 = Chủ Nhật. */
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @Type(() => Number)
  weekdays!: number[];

  @IsString()
  @Matches(DATE_PATTERN, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  startDate!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  endDate?: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime phải có định dạng HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime phải có định dạng HH:mm' })
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  sessionCount?: number;
}

/** Tạo lớp mới kèm lịch lặp và sinh session ngay. */
export class GenerateSessionsDto extends ScheduleRuleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  classCode!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  courseId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  branchId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  teacherId!: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId!: number;

  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  maxStudents!: number;
}

/** Sinh session cho một lớp đã tồn tại. */
export class GenerateSessionsForClassDto extends ScheduleRuleDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId!: number;
}

/** Preview lịch cho một lớp đã tồn tại — GV/phòng mặc định lấy theo lớp. */
export class PreviewSessionsForClassDto extends ScheduleRuleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  roomId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  teacherId?: number;
}
