import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExamDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  classId!: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Tên bài thi phải có ít nhất 2 ký tự' })
  @MaxLength(255, { message: 'Tên bài thi không được vượt quá 255 ký tự' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Loại bài thi không được vượt quá 50 ký tự' })
  examType?: string;

  @IsString()
  @IsNotEmpty()
  scheduledAt!: string; // ISO 8601 datetime string

  @IsInt()
  @Min(0, { message: 'Điểm tối đa phải lớn hơn hoặc bằng 0' })
  @Max(1000, { message: 'Điểm tối đa không được vượt quá 1000' })
  @Type(() => Number)
  maxScore!: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Trọng số phải lớn hơn hoặc bằng 0' })
  @Max(100, { message: 'Trọng số không được vượt quá 100' })
  @Type(() => Number)
  weightPercent?: number;
}
