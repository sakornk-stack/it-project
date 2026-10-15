import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { UsersModule } from './modules/users/users.module';
import { UserManagementModule } from './modules/users/user-management/user-management.module';
import { AuthModule } from './modules/auth/auth.module';
import { CurriculumContentModule } from './modules/curriculum-content/curriculum-content.module';
import { AcademicRecordModule } from './modules/academic-record/academic-record.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module';
import { CareerFitModule } from './modules/career-fit/career-fit.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    OrganizationModule,
    UsersModule,
    UserManagementModule,
    AuthModule,
    CurriculumContentModule,
    AcademicRecordModule,
    DashboardModule,
    AiAnalysisModule,
    CareerFitModule,
    // Further feature modules are registered here one phase at a time.
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
