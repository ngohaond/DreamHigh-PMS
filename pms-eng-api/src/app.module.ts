import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClassesModule } from './modules/classes/classes.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { EnrollmentModule } from './modules/enrollment/enrollment.module';
import { LeadsModule } from './modules/leads/leads.module';
import { StudentsModule } from './modules/students/students.module';
import { AuditModule } from './modules/audit/audit.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './health/health.module';

import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ClassesModule,
    CategoriesModule,
    AuditModule,
    LeadsModule,
    StudentsModule,
    EnrollmentModule,
    ScheduleModule,
    FinanceModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule {}
