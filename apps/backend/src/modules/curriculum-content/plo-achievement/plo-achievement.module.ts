import { Module } from '@nestjs/common';
import { CreditCheckerModule } from '../../academic-record/credit-checker/credit-checker.module';
import { StudentCourseRecordModule } from '../../academic-record/student-course-record/student-course-record.module';
import { CurriculumModule } from '../../organization/curriculum/curriculum.module';
import { StudentProfileModule } from '../../users/student-profile/student-profile.module';
import { CloAchievementModule } from '../clo-achievement/clo-achievement.module';
import { InstructorModule } from '../../../common/scope/instructor.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { PloAchievementController } from './plo-achievement.controller';
import { PloAchievementService } from './plo-achievement.service';

@Module({
  imports: [
    StudentProfileModule,
    StudentCourseRecordModule,
    CloAchievementModule,
    CurriculumModule,
    CreditCheckerModule,
    InstructorModule,
    ScopeModule,
  ],
  controllers: [PloAchievementController],
  providers: [PloAchievementService],
  exports: [PloAchievementService],
})
export class PloAchievementModule {}
