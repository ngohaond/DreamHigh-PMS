import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePlacementTestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  branchId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  listeningScore!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readingScore!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  writingScore!: number;

  @IsDateString()
  testDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}