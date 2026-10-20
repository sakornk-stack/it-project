import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../modules/auth/request-user.interface';
import { actingRole, assertNoSecretKeys, type AuditSnapshot } from './audit-log.util';

export type AuditTargetType =
  | 'StudentCourseRecord'
  | 'StudentProfile'
  | 'StudentInvitation'
  | 'Course'
  | 'CourseCategory'
  | 'CurriculumRequirement'
  | 'Prerequisite'
  | 'Clo';

export interface AuditEntry {
  action: AuditAction;
  actor: RequestUser;
  targetType: AuditTargetType;
  targetId: string;
  studentProfileId: string | null;
  programId: string;
  before?: AuditSnapshot | null;
  after?: AuditSnapshot | null;
  reason?: string | null;
}

// Newest first; one student's history stays far below this in practice.
const HISTORY_LIMIT = 200;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // `tx` is required on purpose (no default to this.prisma): the row must be
  // written in the same transaction as the change it records, so both commit
  // or neither does.
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    assertNoSecretKeys(entry.before);
    assertNoSecretKeys(entry.after);
    await tx.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actor.userId,
        actorRole: actingRole(entry.actor.roles),
        targetType: entry.targetType,
        targetId: entry.targetId,
        studentProfileId: entry.studentProfileId,
        programId: entry.programId,
        before: entry.before ?? undefined,
        after: entry.after ?? undefined,
        reason: entry.reason ?? null,
      },
    });
  }

  // The caller has already scope-checked the student (ScopeGuard on the route).
  // The actor's name is looked up separately because the table has no foreign
  // key; an account deleted since then comes back as actorName: null. Never
  // returns an email.
  async findForStudent(studentProfileId: string) {
    const rows = await this.prisma.auditLog.findMany({
      where: { studentProfileId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    const actorIds = [...new Set(rows.map((row) => row.actorUserId))];
    const actors = await this.prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true },
    });
    const nameById = new Map(actors.map((actor) => [actor.id, actor.fullName]));
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      actorRole: row.actorRole,
      actorName: nameById.get(row.actorUserId) ?? null,
      targetId: row.targetId,
      before: row.before,
      after: row.after,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }
}
