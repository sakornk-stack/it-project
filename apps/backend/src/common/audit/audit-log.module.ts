import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

// Leaf module like ScopeModule: depends only on the @Global() PrismaService.
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
