import { Module } from '@nestjs/common';
import { ArrearsController } from './arrears.controller';
import { ArrearsService } from './arrears.service';
import { FinanceController } from './finance.controller';
import { FinanceEvents } from './finance.events';
import { FinanceService } from './finance.service';
import { ReceiptService } from './receipt.service';

@Module({
  controllers: [FinanceController, ArrearsController],
  providers: [FinanceEvents, FinanceService, ReceiptService, ArrearsService],
})
export class FinanceModule {}