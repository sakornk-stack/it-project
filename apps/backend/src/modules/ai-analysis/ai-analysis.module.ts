import { Module } from '@nestjs/common';
import { CreditCheckerModule } from '../academic-record/credit-checker/credit-checker.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';

@Module({
  imports: [DashboardModule, CreditCheckerModule],
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService],
})
export class AiAnalysisModule {}
