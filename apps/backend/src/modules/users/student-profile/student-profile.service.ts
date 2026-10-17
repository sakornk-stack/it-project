import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { ProgramService } from '../../organization/program/program.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { UserRoleService } from '../user-role/user-role.service';
import { ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import { RequestUser } from '../../auth/request-user.interface';

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRoleService: UserRoleService,
    private readonly programService: ProgramService,
    private readonly curriculumService: CurriculumService,
    private readonly scopeResolverService: ScopeResolverService,
  ) {}

  async create(
    userId: string,
    studentCode: string,
    programId: string,
    curriculumId: string,
    admissionYear: number,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    const hasStudentRole = await this.userRoleService.hasRole(
      userId,
      Role.STUDENT,
      tx,
    );
    if (!hasStudentRole) {
      throw new BadRequestException(
        `User ${userId} does not have the STUDENT role assigned yet`,
      );
    }

    await this.validateProgramAndCurriculum(programId, curriculumId, tx);

    try {
      return await tx.studentProfile.create({
        data: { userId, studentCode, programId, curriculumId, admissionYear },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User ${userId} already has a student profile, or student code "${studentCode}" is already in use`,
        );
      }
      throw error;
    }
  }

  // Shared by StudentProfileService.create and StudentInvitationService.create
  // (CONVENTIONS.md §6) — the DB compound FK (programId, curriculumId) ->
  // Curriculum(programId, id) would reject a mismatch anyway, but checking
  // here first gives a clear error message instead of a raw Prisma
  // foreign-key-violation, and lets an invitation fail fast at creation
  // time rather than weeks later when the student actually registers.
  async validateProgramAndCurriculum(
    programId: string,
    curriculumId: string,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    await this.programService.findActiveByIdOrThrow(programId, tx);
    const curriculum = await this.curriculumService.findActiveByIdOrThrow(
      curriculumId,
      tx,
    );

    if (curriculum.programId !== programId) {
      throw new BadRequestException(
        `Curriculum ${curriculumId} does not belong to program ${programId}`,
      );
    }

    return curriculum;
  }

  // Used by StudentCourseRecordService (and future self-service modules,
  // per CONVENTIONS.md §3a) to resolve the authenticated user's own
  // studentProfileId before applying a query-level ownership filter.
  async findByUserId(userId: string, tx: PrismaClientOrTx = this.prisma) {
    const profile = await tx.studentProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        `No student profile found for user ${userId}`,
      );
    }
    return profile;
  }

  // Used by StudentCourseRecordService to validate a dependent
  // relationship when a SUPER_ADMIN supplies a studentProfileId directly.
  // `include: { user }` added for the STAFF Student Directory UI, which
  // needs a name to show — not just a bare studentCode.
  async findActiveByIdOrThrow(
    id: string,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    const profile = await tx.studentProfile.findUnique({
      where: { id },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!profile || !profile.isActive) {
      throw new NotFoundException(`Active student profile ${id} not found`);
    }
    return profile;
  }

  // §10: ADMIN/STAFF see only students in programs their scope covers —
  // query-level filtered (CONVENTIONS §3a), never fetch-all-then-filter-in-
  // memory. SUPER_ADMIN has no access to student data (the controller's @Roles
  // excludes it), so there is deliberately no unfiltered branch here.
  async findAllScoped(user: RequestUser) {
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    return this.prisma.studentProfile.findMany({
      where: { programId: { in: programIds } },
      include: { user: { select: { fullName: true, email: true } } },
    });
  }
}
