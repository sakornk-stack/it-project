import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { CurriculumModule } from '../../organization/curriculum/curriculum.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { PloController } from './plo.controller';
import { PloService } from './plo.service';

@Module({
  imports: [CurriculumModule, ScopeModule, AuditLogModule],
  controllers: [PloController],
  providers: [PloService],
  exports: [PloService],
})
export class PloModule {}
