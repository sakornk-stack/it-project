import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CloModule } from '../clo/clo.module';
import { CourseModule } from '../course/course.module';
import { PloModule } from '../plo/plo.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { CloPloMappingController } from './clo-plo-mapping.controller';
import { CloPloMappingService } from './clo-plo-mapping.service';

@Module({
  imports: [CloModule, PloModule, CourseModule, ScopeModule, AuditLogModule],
  controllers: [CloPloMappingController],
  providers: [CloPloMappingService],
  exports: [CloPloMappingService],
})
export class CloPloMappingModule {}
