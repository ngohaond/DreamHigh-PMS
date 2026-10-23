import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateInvoiceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  feePlanId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classId?: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ValidateIf((value: CreateInvoiceDto) => value.discountType !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1000000000)
  discountValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}