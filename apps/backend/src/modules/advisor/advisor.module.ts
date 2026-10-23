import { Module } from '@nestjs/common';
import { CreditCheckerModule } from '../academic-record/credit-checker/credit-checker.module';
import { StudentCourseRecordModule } from '../academic-record/student-course-record/student-course-record.module';
import { PloAchievementModule } from '../curriculum-content/plo-achievement/plo-achievement.module';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [StudentCourseRecordModule, CreditCheckerModule, PloAchievementModule],
  controllers: [AdvisorController],
  providers: [AdvisorService],
})
export class AdvisorModule {}
