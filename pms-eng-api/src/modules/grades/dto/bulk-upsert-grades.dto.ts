import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class GradeEntryDto {
  @IsInt()
  @Min(1, { message: 'ID học sinh không hợp lệ' })
  @Type(() => Number)
  studentId!: number;

  @IsInt()
  @Min(0, { message: 'Điểm số phải lớn hơn hoặc bằng 0' })
  @Type(() => Number)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Nhãn điểm không được vượt quá 20 ký tự' })
  gradeLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Ghi chú không được vượt quá 1000 ký tự' })
  remarks?: string;
}

export class BulkUpsertGradesDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Danh sách điểm không được để trống' })
  @ValidateNested({ each: true })
  @Type(() => GradeEntryDto)
  grades!: GradeEntryDto[];
}
