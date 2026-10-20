import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CourseModule } from '../course/course.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { PrerequisiteController } from './prerequisite.controller';
import { PrerequisiteService } from './prerequisite.service';

@Module({
  imports: [CourseModule, ScopeModule, AuditLogModule],
  controllers: [PrerequisiteController],
  providers: [PrerequisiteService],
  exports: [PrerequisiteService],
})
export class PrerequisiteModule {}
