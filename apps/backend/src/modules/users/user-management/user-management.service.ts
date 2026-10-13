import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import {
  generateTempPassword,
  hashPassword,
} from '../../../common/util/password.util';
import { RequestUser } from '../../auth/request-user.interface';
import { PasswordResetService } from '../../auth/password-reset.service';
import { EmailService } from '../../../common/email/email.service';
import { UserService } from '../user/user.service';
import { UserRoleService } from '../user-role/user-role.service';
import { UserScopeService } from '../user-scope/user-scope.service';
import { CreateUserDto } from './dto/create-user.dto';
import { assertMayManageTarget } from './admin-manage-target.util';

const SUPER_ADMIN_PEER_MESSAGE = 'ไม่สามารถระงับหรือเปลี่ยนสถานะบัญชีผู้ดูแลระบบสูงสุดคนอื่นได้';
const SELF_RESEND_MESSAGE = 'ไม่สามารถส่งคำเชิญให้บัญชีของตัวเองได้';
const PASSWORD_ALREADY_SET_MESSAGE =
  'ผู้ใช้นี้ตั้งรหัสผ่านแล้ว จึงส่งคำเชิญซ้ำไม่ได้ หากลืมรหัสผ่านให้ใช้ "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ';
const RESEND_EMAIL_FAILED_MESSAGE =
  'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้งภายหลัง หากยังไม่สำเร็จให้ตรวจสอบการตั้งค่าอีเมลของระบบ';
const SELF_ROLE_MESSAGE = 'ไม่สามารถถอดบทบาทของตัวเองได้';
const SELF_ASSIGN_ROLE_MESSAGE = 'ไม่สามารถกำหนดบทบาทให้ตัวเองได้';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly userRoleService: UserRoleService,
    private readonly userScopeService: UserScopeService,
    private readonly scopeResolverService: ScopeResolverService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailService: EmailService,
  ) {}

  async createStaffOrAdmin(dto: CreateUserDto, requester: RequestUser) {
    // STUDENT is /auth/register-only — never a second code path that can
    // create a student account (CONVENTIONS.md §6).
    if (dto.role === 'STUDENT') {
      throw new BadRequestException(
        'STUDENT accounts must be created via /auth/register',
      );
    }

    // Advisor feedback (see plan file, "เรื่องที่ 2"): SUPER_ADMIN must
    // never be grantable through this API, even by an existing
    // SUPER_ADMIN — provisioning a new one is a deliberately out-of-band
    // action (direct database write), not something reachable from any
    // UI/API surface. Checked before the requester-role branch below so
    // it applies unconditionally.
    if (dto.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN accounts cannot be created via API — provision directly via database',
      );
    }

    const isSuperAdmin = requester.roles.includes('SUPER_ADMIN');
    if (!isSuperAdmin) {
      // RolesGuard already restricted this route to SUPER_ADMIN|ADMIN, so
      // reaching here as non-SUPER_ADMIN means the requester is ADMIN.
      if (dto.role !== 'STAFF') {
        throw new ForbiddenException('ADMIN may only create STAFF accounts');
      }
      if (!dto.scope) {
        throw new BadRequestException(
          'scope is required when creating a user as ADMIN',
        );
      }

      const ancestry = await this.scopeResolverService.resolveAncestryForLevel(
        dto.scope.level,
        dto.scope.targetId,
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

    // Real email service now exists (EmailService) — the account gets an
    // unusable, never-revealed password hash instead of a temp password
    // the requester would have to copy and hand over out-of-band. The new
    // user sets their own real password via the same reset-token/email
    // flow POST /auth/forgot-password already uses (see below).
    // generateTempPassword() is reused purely as an entropy source here —
    // its output never leaves this function.
    const unusablePassword = generateTempPassword();
    const passwordHash = await hashPassword(unusablePassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await this.userService.create(
        dto.email,
        passwordHash,
        dto.fullName,
        tx,
        true, // mustChangePassword — the generated hash is unusable anyway; kept true for defense in depth
      );
      await this.userRoleService.assignRole(createdUser.id, dto.role, tx);
      if (dto.scope) {
        await this.userScopeService.assignScope(
          createdUser.id,
          dto.scope.level,
          dto.scope.targetId,
          tx,
        );
      }
      return createdUser;
    });

    // Outside the transaction — token creation/email sending are not part
    // of the "did the account get created" guarantee. Best-effort: if
    // SMTP is down, the account still exists and the new user (or the
    // requester on their behalf) can always retry via the ordinary
    // POST /auth/forgot-password self-service flow, same mechanism.
    let passwordSetupEmailSent = true;
    try {
      const token = await this.passwordResetService.create(user.id);
      await this.emailService.sendPasswordSetupEmail(user.email, token, 'new-account');
    } catch {
      passwordSetupEmailSent = false;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordSetupEmailSent,
    };
  }

  async listUsers(requester: RequestUser) {
    if (requester.roles.includes('SUPER_ADMIN')) {
      const users = await this.userService.findAll({
        userRoles: { none: { role: 'STUDENT' } },
      });
      return users.map((user) => this.toSummary(user));
    }

    const users = await this.userService.findAll({
      userRoles: { none: { role: 'STUDENT' } },
      scopes: { some: { OR: await this.scopeResolverService.buildUserScopeOrFilter(requester.userId) } },
    });
    return users.map((user) => this.toSummary(user));
  }

  // Narrow, STAFF-reachable alternative to GET /users (which stays
  // ADMIN/SUPER_ADMIN-only) — STAFF needs *some* way to find an
  // INSTRUCTOR's userId to assign them to a CourseInstructor, but must not
  // browse the full user list or see role/scope details of other accounts.
  //
  // Not scope-filtered by UserScope, unlike listUsers: INSTRUCTOR access is
  // modeled per-course via CourseInstructor, not via org-hierarchy
  // UserScope like ADMIN/STAFF — an instructor usually has no UserScope
  // row at all, so filtering on it would incorrectly return empty for
  // every non-SUPER_ADMIN caller. The actual scope check for who STAFF can
  // assign to which course still happens where it matters: ScopeGuard on
  // POST /course-instructors's `courseId`.
  async listInstructors() {
    const users = await this.userService.findAll({
      isActive: true,
      userRoles: { some: { role: 'INSTRUCTOR' } },
    });
    return users.map((user) => this.toInstructorListItem(user));
  }

  private toInstructorListItem(user: { id: string; fullName: string; email: string }) {
    return { id: user.id, fullName: user.fullName, email: user.email };
  }

  async findOne(id: string, requester: RequestUser) {
    if (requester.roles.includes('SUPER_ADMIN')) {
      const user = await this.userService.findOneWhere({ id });
      return this.toSummary(user);
    }

    const user = await this.userService.findOneWhere({
      id,
      scopes: { some: { OR: await this.scopeResolverService.buildUserScopeOrFilter(requester.userId) } },
    });
    return this.toSummary(user);
  }

  // Flattens the userRoles relation into roles: Role[], matching the
  // convention AuthService.getMe's CurrentUserResponse already uses —
  // scopes passes through as-is (raw UserScope[] rows, no joined names;
  // the frontend resolves faculty/department/program names client-side
  // from the org-structure lists it already fetches everywhere else).
  private toSummary(
    user: Prisma.UserGetPayload<{
      omit: { passwordHash: true };
      include: { userRoles: true; scopes: true };
    }>,
  ) {
    const { userRoles, ...rest } = user;
    return { ...rest, roles: userRoles.map((userRole) => userRole.role) };
  }

  async updateActiveStatus(id: string, isActive: boolean, requester: RequestUser) {
    // Enforced here, not just in the UI: nobody (SUPER_ADMIN included) may
    // lock themselves out.
    if (id === requester.userId) {
      throw new ForbiddenException('ไม่สามารถระงับหรือเปลี่ยนสถานะบัญชีของตัวเองได้');
    }
    // Reuses the same scope-filtered lookup as findOne — a natural 404 if
    // the target is outside the ADMIN's scope, no special-case branch.
    const target = await this.findOne(id, requester);
    assertMayManageTarget(target.roles, requester);
    if (target.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(SUPER_ADMIN_PEER_MESSAGE);
    }

    // Suspending is account-wide, so an ADMIN may only do it when every
    // scope the target holds sits inside the ADMIN's own scope.
    if (!isActive && !requester.roles.includes('SUPER_ADMIN')) {
      const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
        requester.userId,
      );
      const allCovered = target.scopes.every((scope) =>
        this.scopeResolverService.isCovered(
          {
            facultyId: scope.facultyId,
            departmentId: scope.departmentId,
            programId: scope.programId,
          },
          effectiveScopes,
        ),
      );
      if (!allCovered) {
        throw new ForbiddenException(
          'ผู้ใช้นี้มีขอบเขตนอกเหนือขอบเขตของคุณ จึงระงับทั้งบัญชีไม่ได้ กรุณาถอดขอบเขตของคุณออกจากผู้ใช้นี้แทน',
        );
      }
    }
    return this.userService.setActiveStatus(id, isActive);
  }

  // Same mechanism createStaffOrAdmin uses: a fresh password-setup token
  // (PasswordResetService.create drops any earlier unused one) mailed as a
  // link to /reset-password. "Has not set a password yet" is
  // mustChangePassword — true from creation (with an unusable hash) until
  // resetPassword/changePassword clears it — so no schema field is needed.
  async resendInvitation(id: string, requester: RequestUser) {
    if (id === requester.userId) {
      throw new ForbiddenException(SELF_RESEND_MESSAGE);
    }
    // Natural 404 if the target is outside the ADMIN's scope; an ADMIN may
    // then only act on STAFF-only accounts, SUPER_ADMIN on anyone but self.
    const target = await this.findOne(id, requester);
    assertMayManageTarget(target.roles, requester);

    if (!target.mustChangePassword) {
      throw new ConflictException(PASSWORD_ALREADY_SET_MESSAGE);
    }

    // The token and the link are secrets: neither is ever logged, only the event.
    try {
      const token = await this.passwordResetService.create(id);
      await this.emailService.sendPasswordSetupEmail(target.email, token, 'new-account');
    } catch {
      throw new ServiceUnavailableException(RESEND_EMAIL_FAILED_MESSAGE);
    }
    this.logger.log(`Password setup email resent for user ${id}`);
    return { passwordSetupEmailSent: true };
  }

  async assignRole(id: string, role: Role, requester: RequestUser) {
    // Nobody grants themselves a role — otherwise an account whose own role has no access to
    // academic data could hand itself a role that does.
    if (id === requester.userId) {
      throw new ForbiddenException(SELF_ASSIGN_ROLE_MESSAGE);
    }
    await this.assertRoleActionAllowed(id, role, requester);
    return this.userRoleService.assignRole(id, role);
  }

  async revokeRole(id: string, role: Role, requester: RequestUser) {
    if (id === requester.userId) {
      throw new ForbiddenException(SELF_ROLE_MESSAGE);
    }
    await this.assertRoleActionAllowed(id, role, requester);
    return this.userRoleService.revokeRole(id, role);
  }

  private async assertRoleActionAllowed(
    id: string,
    role: Role,
    requester: RequestUser,
  ) {
    if (role === 'STUDENT') {
      throw new BadRequestException(
        'STUDENT role is not managed through this endpoint',
      );
    }
    // Same unconditional block as createStaffOrAdmin — SUPER_ADMIN is
    // never grantable (or revocable) through this API, regardless of the
    // requester's own role.
    if (role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'SUPER_ADMIN role cannot be managed via API — provision directly via database',
      );
    }
    // Natural 404 if the target is outside the ADMIN's scope.
    const target = await this.findOne(id, requester);
    assertMayManageTarget(target.roles, requester);

    if (!requester.roles.includes('SUPER_ADMIN') && role !== 'STAFF') {
      throw new ForbiddenException('ADMIN may only manage the STAFF role');
    }
  }

}
