import { Type } from 'class-transformer';
import {
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

/** Tạo lớp học mới (chưa sinh buổi học — dùng `POST /classes/with-sessions` nếu cần sinh lịch kèm). */
export class CreateClassDto {
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
  @Max(500)
  @Type(() => Number)
  maxStudents!: number;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  startDate!: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  endDate?: string;
}

/** Cập nhật lớp học. */
export class UpdateClassDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  courseId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  branchId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  teacherId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  maxStudents?: number;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'startDate phải có định dạng YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'endDate phải có định dạng YYYY-MM-DD' })
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;
}

/** Lọc danh sách lớp học. */
export class ListClassesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  branchId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  courseId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  teacherId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
