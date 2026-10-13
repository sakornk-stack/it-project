import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScopeLevel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { ScopeAncestry, ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import { RequestUser } from '../../auth/request-user.interface';
import { FacultyService } from '../../organization/faculty/faculty.service';
import { DepartmentService } from '../../organization/department/department.service';
import { ProgramService } from '../../organization/program/program.service';
import { UserService } from '../user/user.service';
import { assertMayManageTarget } from '../user-management/admin-manage-target.util';

const SELF_SCOPE_MESSAGE = 'ไม่สามารถแก้ไขขอบเขตของตัวเองได้';

@Injectable()
export class UserScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly facultyService: FacultyService,
    private readonly departmentService: DepartmentService,
    private readonly programService: ProgramService,
    private readonly scopeResolverService: ScopeResolverService,
  ) {}

  // targetId is mapped onto exactly one of facultyId/departmentId/programId
  // based on level — this construction guarantees the XOR invariant (never
  // zero, never more than one FK set) by design, rather than validating it
  // after the fact. Pure entity operation, no requester/authorization
  // concern — used internally by UserManagementService's create-user
  // transaction (tx) and by this service's own requester-aware grantScope
  // (below), which does the authorization check first.
  async assignScope(
    userId: string,
    level: ScopeLevel,
    targetId: string,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    await this.userService.findById(userId, tx);

    switch (level) {
      case ScopeLevel.FACULTY:
        await this.facultyService.findActiveByIdOrThrow(targetId);
        return tx.userScope.create({
          data: { userId, level, facultyId: targetId },
        });
      case ScopeLevel.DEPARTMENT:
        await this.departmentService.findActiveByIdOrThrow(targetId);
        return tx.userScope.create({
          data: { userId, level, departmentId: targetId },
        });
      case ScopeLevel.PROGRAM:
        await this.programService.findActiveByIdOrThrow(targetId);
        return tx.userScope.create({
          data: { userId, level, programId: targetId },
        });
      default:
        throw new BadRequestException(`Unsupported scope level: ${level}`);
    }
  }

  async findByUserId(userId: string) {
    await this.userService.findById(userId);
    return this.prisma.userScope.findMany({ where: { userId } });
  }

  async revokeScope(scopeId: string) {
    const existing = await this.prisma.userScope.findUnique({
      where: { id: scopeId },
    });
    if (!existing) {
      throw new NotFoundException(`Scope ${scopeId} not found`);
    }
    return this.prisma.userScope.delete({ where: { id: scopeId } });
  }

  // --- HTTP-facing, requester-aware methods (used by UserScopeController) ---
  // A User is personal data (CONVENTIONS §3a), unlike Faculty/Department —
  // so "target user outside your scope" is always 404, never 403. A grant
  // that's outside your own scope (the level/targetId being assigned) is
  // 403 — nothing existing is being probed, it's "you can't grant that."

  async grantScope(
    targetUserId: string,
    level: ScopeLevel,
    targetId: string,
    requester: RequestUser,
  ) {
    await this.assertUserVisible(targetUserId, requester);

    // Separation-of-duties: nobody widens (or touches at all) their own scope.
    if (requester.userId === targetUserId) {
      throw new ForbiddenException(SELF_SCOPE_MESSAGE);
    }

    if (!requester.roles.includes('SUPER_ADMIN')) {
      await this.assertTargetManageable(targetUserId, requester);

      const ancestry = await this.scopeResolverService.resolveAncestryForLevel(
        level,
        targetId,
      );
      const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
        requester.userId,
      );
      if (!this.scopeResolverService.isCovered(ancestry, effectiveScopes)) {
        throw new ForbiddenException(
          'You do not have scope covering this grant',
        );
      }
    }

    return this.assignScope(targetUserId, level, targetId);
  }

  async listForUser(targetUserId: string, requester: RequestUser) {
    await this.assertUserVisible(targetUserId, requester);
    return this.findByUserId(targetUserId);
  }

  async revoke(scopeId: string, requester: RequestUser) {
    const scope = await this.prisma.userScope.findUnique({
      where: { id: scopeId },
    });
    if (!scope || !(await this.isUserVisibleTo(scope.userId, requester))) {
      // Same message for "doesn't exist" and "exists but not yours" —
      // CONVENTIONS §3a.
      throw new NotFoundException(`Scope ${scopeId} not found`);
    }

    // Nobody — SUPER_ADMIN included — may remove their own scope.
    if (requester.userId === scope.userId) {
      throw new ForbiddenException(SELF_SCOPE_MESSAGE);
    }

    if (!requester.roles.includes('SUPER_ADMIN')) {
      await this.assertTargetManageable(scope.userId, requester);

      const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
        requester.userId,
      );
      const ancestry: ScopeAncestry = {
        facultyId: scope.facultyId,
        departmentId: scope.departmentId,
        programId: scope.programId,
      };
      if (!this.scopeResolverService.isCovered(ancestry, effectiveScopes)) {
        throw new ForbiddenException(
          'You do not have scope covering this revoke',
        );
      }
    }

    return this.revokeScope(scopeId);
  }

  private async assertTargetManageable(
    targetUserId: string,
    requester: RequestUser,
  ) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId: targetUserId },
      select: { role: true },
    });
    assertMayManageTarget(
      rows.map((row) => row.role),
      requester,
    );
  }

  private async assertUserVisible(targetUserId: string, requester: RequestUser) {
    await this.userService.findById(targetUserId);
    if (!(await this.isUserVisibleTo(targetUserId, requester))) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }
  }

  // A scope-less user is only visible to SUPER_ADMIN — there's nothing
  // for an ADMIN's coverage to match against.
  private async isUserVisibleTo(
    targetUserId: string,
    requester: RequestUser,
  ): Promise<boolean> {
    if (requester.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const targetScopes = await this.prisma.userScope.findMany({
      where: { userId: targetUserId },
    });
    if (targetScopes.length === 0) {
      return false;
    }

    const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
      requester.userId,
    );
    return targetScopes.some((targetScope) =>
      this.scopeResolverService.isCovered(
        {
          facultyId: targetScope.facultyId,
          departmentId: targetScope.departmentId,
          programId: targetScope.programId,
        },
        effectiveScopes,
      ),
    );
  }
}
