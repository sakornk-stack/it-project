import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../prisma/prisma.types';
import { ScopeResolverService } from '../../common/scope/scope-resolver.service';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { UserService } from '../users/user/user.service';
import { RequestUser } from './request-user.interface';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateStudentInvitationParams {
  email: string;
  fullName: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
}

// STAFF-facing counterpart to PendingInvitation, but for STUDENT accounts
// that don't exist yet (see schema.prisma comment on StudentInvitation for
// why this can never gain a User FK like PendingInvitation has). A row
// here is pure draft data, consumed only inside
// AuthService.createStudentAccount's transaction when the invited person
// actually registers — never a shortcut that creates the User itself.
@Injectable()
export class StudentInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly userService: UserService,
    private readonly scopeResolverService: ScopeResolverService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    params: CreateStudentInvitationParams,
    invitedByUserId: string,
  ): Promise<string> {
    await this.studentProfileService.validateProgramAndCurriculum(
      params.programId,
      params.curriculumId,
    );

    const existingProfile = await this.prisma.studentProfile.findUnique({
      where: { studentCode: params.studentCode },
    });
    if (existingProfile) {
      throw new ConflictException(
        `Student code "${params.studentCode}" is already in use`,
      );
    }

    // studentCode has no DB-level unique constraint on this table (unlike
    // StudentProfile) — two different pending invitations could otherwise
    // claim the same code. Excludes rows for the SAME email so
    // re-uploading a corrected CSV for someone already invited doesn't
    // trip over their own prior invitation (that case is handled by the
    // delete-then-recreate below).
    const existingInvitation = await this.prisma.studentInvitation.findFirst({
      where: { studentCode: params.studentCode, email: { not: params.email } },
    });
    if (existingInvitation) {
      throw new ConflictException(
        `Student code "${params.studentCode}" already has a pending invitation`,
      );
    }

    let existingUser = true;
    try {
      await this.userService.findByEmail(params.email);
    } catch (error) {
      if (error instanceof NotFoundException) {
        existingUser = false;
      } else {
        throw error;
      }
    }
    if (existingUser) {
      throw new ConflictException(
        `An account already exists for ${params.email}`,
      );
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    // Delete-then-recreate on the same email — same posture as
    // PendingInvitationService.resend: re-uploading a corrected CSV row
    // for someone already invited replaces their old token rather than
    // piling up a 409.
    await this.prisma.$transaction(async (tx) => {
      await tx.studentInvitation.deleteMany({
        where: { email: params.email },
      });
      await tx.studentInvitation.create({
        data: {
          tokenHash,
          email: params.email,
          fullName: params.fullName,
          studentCode: params.studentCode,
          programId: params.programId,
          curriculumId: params.curriculumId,
          admissionYear: params.admissionYear,
          invitedByUserId,
          expiresAt,
        },
      });
    });

    return token;
  }

  async findValidByToken(token: string, tx: PrismaClientOrTx = this.prisma) {
    const pending = await tx.studentInvitation.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Invitation expired or invalid — ask staff to send a new one',
      );
    }

    return pending;
  }

  async consume(id: string, tx: PrismaClientOrTx = this.prisma) {
    return tx.studentInvitation.delete({ where: { id } });
  }

  // Delete-then-recreate under a fresh token+TTL — mirrors
  // PendingInvitationService.resend. Re-validates program/curriculum/
  // studentCode/email exactly like create() (nothing here should have
  // gone stale, but resend is also the natural place to catch it if it
  // has — e.g. the program was deactivated since the original invite).
  async resend(
    id: string,
    invitedByUserId: string,
  ): Promise<{ token: string; email: string; fullName: string }> {
    const existing = await this.prisma.studentInvitation.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Student invitation ${id} not found`);
    }

    // No upfront delete here — create()'s own delete-by-email is what
    // removes this exact row (same email), and it only runs once the new
    // row is about to be inserted in the same transaction. Deleting here
    // first would lose the invitation for good if create() then threw
    // (e.g. re-validation now fails because the program was deactivated).
    const token = await this.create(
      {
        email: existing.email,
        fullName: existing.fullName,
        studentCode: existing.studentCode,
        programId: existing.programId,
        curriculumId: existing.curriculumId,
        admissionYear: existing.admissionYear,
      },
      invitedByUserId,
    );
    return { token, email: existing.email, fullName: existing.fullName };
  }

  // STAFF withdrawing an invitation sent by mistake (ScopeGuard has checked the
  // program). Deleting the row is the same end state as consume() and expiry:
  // the token stops working at once. Audited in the same transaction, without
  // the invitee's email, name or token hash.
  async cancel(id: string, requester: RequestUser): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.studentInvitation.findUnique({ where: { id } });
      // deleteMany, not delete: an invitation consumed by a sign-up in the
      // meantime answers the same 404 as one that never existed.
      const { count } = await tx.studentInvitation.deleteMany({ where: { id } });
      if (!invitation || count === 0) {
        throw new NotFoundException(`Student invitation ${id} not found`);
      }
      await this.auditLogService.record(tx, {
        action: 'STUDENT_INVITATION_CANCEL',
        actor: requester,
        targetType: 'StudentInvitation',
        targetId: id,
        studentProfileId: null,
        programId: invitation.programId,
        before: {
          studentCode: invitation.studentCode,
          programId: invitation.programId,
          curriculumId: invitation.curriculumId,
          admissionYear: invitation.admissionYear,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      });
    });
  }

  // §10/CONVENTIONS §3a: SUPER_ADMIN sees every pending invitation;
  // STAFF/ADMIN see only the ones targeting a program their scope
  // covers — same query-level filter as StudentProfileService.findAllScoped.
  // `select` (not `include`) deliberately omits tokenHash — a listing
  // response has no business exposing it, even hashed.
  async findAllInScope(user: RequestUser) {
    const idSelect = { id: true };
    const withoutPii = {
      ...idSelect,
      programId: true,
      curriculumId: true,
      admissionYear: true,
      expiresAt: true,
      createdAt: true,
      program: { select: { code: true, name: true } },
    };
    const piiSelect = { email: true, fullName: true, studentCode: true };
    // Same keys (and order) as before: id, email, fullName, studentCode, …
    const select = { ...idSelect, ...piiSelect, ...withoutPii };

    // SUPER_ADMIN gets the operational view only — the student's identity
    // (email/name/student code) is stripped at the query level.
    if (user.roles.includes('SUPER_ADMIN')) {
      return this.prisma.studentInvitation.findMany({
        select: withoutPii,
        orderBy: { createdAt: 'desc' },
      });
    }
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    return this.prisma.studentInvitation.findMany({
      where: { programId: { in: programIds } },
      select,
      orderBy: { createdAt: 'desc' },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
