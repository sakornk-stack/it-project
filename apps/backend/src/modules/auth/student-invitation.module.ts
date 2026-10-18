import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScopeModule } from '../../common/scope/scope.module';
import { AuditLogModule } from '../../common/audit/audit-log.module';
import { EmailModule } from '../../common/email/email.module';
import { UsersModule } from '../users/users.module';
import { StudentInvitationService } from './student-invitation.service';
import { StudentInvitationController } from './student-invitation.controller';

@Module({
  imports: [PrismaModule, ScopeModule, AuditLogModule, EmailModule, UsersModule],
  controllers: [StudentInvitationController],
  providers: [StudentInvitationService],
  exports: [StudentInvitationService],
})
export class StudentInvitationModule {}
