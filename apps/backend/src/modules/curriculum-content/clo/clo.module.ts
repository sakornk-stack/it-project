import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CourseModule } from '../course/course.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { CloController } from './clo.controller';
import { CloService } from './clo.service';

@Module({
  imports: [CourseModule, ScopeModule, AuditLogModule],
  controllers: [CloController],
  providers: [CloService],
  exports: [CloService],
})
export class CloModule {}
