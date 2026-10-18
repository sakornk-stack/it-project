import { Module } from '@nestjs/common';
import { UserRoleModule } from '../user-role/user-role.module';
import { ProgramModule } from '../../organization/program/program.module';
import { CurriculumModule } from '../../organization/curriculum/curriculum.module';
import { ScopeModule } from '../../../common/scope/scope.module';
import { AuditLogModule } from '../../../common/audit/audit-log.module';
import { StudentProfilesController } from './student-profiles.controller';
import { StudentProfileService } from './student-profile.service';

@Module({
  imports: [UserRoleModule, ProgramModule, CurriculumModule, ScopeModule, AuditLogModule],
  controllers: [StudentProfilesController],
  providers: [StudentProfileService],
  exports: [StudentProfileService],
})
export class StudentProfileModule {}
