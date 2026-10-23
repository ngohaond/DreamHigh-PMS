import { PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RecordPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  amount!: number;

  @IsIn([PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER])
  paymentMethod!: 'CASH' | 'BANK_TRANSFER';

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  transactionRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}