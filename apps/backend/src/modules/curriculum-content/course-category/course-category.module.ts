import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CurriculumModule } from '../../organization/curriculum/curriculum.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { CourseCategoryController } from './course-category.controller';
import { CourseCategoryService } from './course-category.service';

@Module({
  imports: [CurriculumModule, ScopeModule, AuditLogModule],
  controllers: [CourseCategoryController],
  providers: [CourseCategoryService],
  exports: [CourseCategoryService],
})
export class CourseCategoryModule {}
