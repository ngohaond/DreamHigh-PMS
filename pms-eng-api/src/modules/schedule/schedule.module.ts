import { Module } from '@nestjs/common';
import {
  ClassScheduleController,
  ReportsController,
  ScheduleController,
} from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  controllers: [ScheduleController, ClassScheduleController, ReportsController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
