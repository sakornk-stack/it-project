import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CurriculumModule } from '../../organization/curriculum/curriculum.module';
import { CourseCategoryModule } from '../course-category/course-category.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { CurriculumRequirementController } from './curriculum-requirement.controller';
import { CurriculumRequirementService } from './curriculum-requirement.service';

@Module({
  imports: [CurriculumModule, CourseCategoryModule, ScopeModule, AuditLogModule],
  controllers: [CurriculumRequirementController],
  providers: [CurriculumRequirementService],
  exports: [CurriculumRequirementService],
})
export class CurriculumRequirementModule {}
