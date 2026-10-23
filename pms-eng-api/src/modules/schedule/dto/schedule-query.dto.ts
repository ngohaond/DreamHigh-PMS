import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Khoảng ngày tra cứu lịch. `from` < `to`, mỗi cạnh tối đa 366 ngày. */
export class ScheduleRangeQueryDto {
  @IsString()
  @Matches(DATE_PATTERN, { message: 'from phải có định dạng YYYY-MM-DD' })
  from!: string;

  @IsString()
  @Matches(DATE_PATTERN, { message: 'to phải có định dạng YYYY-MM-DD' })
  to!: string;
}

/** Tra cứu giờ dạy theo giáo viên. */
export class TeachingHoursQueryDto extends ScheduleRangeQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(366)
  @Type(() => Number)
  teacherId?: number;
}
