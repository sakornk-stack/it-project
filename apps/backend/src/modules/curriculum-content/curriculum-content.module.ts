import { Module } from '@nestjs/common';
import { CloAchievementModule } from './clo-achievement/clo-achievement.module';
import { CloPloMappingModule } from './clo-plo-mapping/clo-plo-mapping.module';
import { CloModule } from './clo/clo.module';
import { CourseAssessmentModule } from './course-assessment/course-assessment.module';
import { CourseCategoryModule } from './course-category/course-category.module';
import { CourseModule } from './course/course.module';
import { CourseInstructorModule } from './course-instructor/course-instructor.module';
import { CurriculumRequirementModule } from './curriculum-requirement/curriculum-requirement.module';
import { PloAchievementModule } from './plo-achievement/plo-achievement.module';
import { PloModule } from './plo/plo.module';
import { PrerequisiteModule } from './prerequisite/prerequisite.module';

@Module({
  imports: [
    CourseCategoryModule,
    CourseModule,
    CourseInstructorModule,
    CourseAssessmentModule,
    CurriculumRequirementModule,
    PrerequisiteModule,
    PloModule,
    CloModule,
    CloPloMappingModule,
    CloAchievementModule,
    PloAchievementModule,
  ],
})
export class CurriculumContentModule {}
