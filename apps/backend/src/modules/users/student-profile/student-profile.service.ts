import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AuditSnapshot } from '../../../common/audit/audit-log.util';
import { RequestUser } from '../../auth/request-user.interface';
import { UpdateStudentActiveStatusDto } from './dto/update-student-active-status.dto';
import { UpdateStudentAdvisorDto } from './dto/update-student-advisor.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';

const REASON_MIN_LENGTH = 5;
const EDITABLE_FIELDS = ['programId', 'curriculumId', 'admissionYear'] as const;

@Injectable()
export class StudentProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userRoleService: UserRoleService,
    private readonly programService: ProgramService,
    private readonly curriculumService: CurriculumService,
    private readonly scopeResolverService: ScopeResolverService,
    private readonly auditLogService: AuditLogService,
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

  // GET /student-profiles/:id (ScopeGuard has checked the program): unlike
  // findActiveByIdOrThrow, a suspended student is returned too, so STAFF can
  // open the page and reactivate them. user.isActive is the sign-in switch.
  async findInScopeById(id: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true, isActive: true } },
        advisor: { select: { id: true, fullName: true, isActive: true } },
      },
    });
    if (!profile) {
      throw new NotFoundException(`Student profile ${id} not found`);
    }
    return profile;
  }

  // STAFF setting, changing or clearing a student's academic advisor
  // (ScopeGuard has checked the program). The advisor must be an active
  // INSTRUCTOR account; like a course assignment, the instructor's own scope
  // is not checked (instructors are not modelled by UserScope). Audited with
  // ids only; the history screen names them.
  async updateAdvisor(id: string, dto: UpdateStudentAdvisorDto, requester: RequestUser) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({ where: { id } });
      if (!profile) {
        throw new NotFoundException(`Student profile ${id} not found`);
      }
      if (!profile.isActive) {
        throw new ConflictException(
          'บัญชีนิสิตนี้ถูกระงับอยู่ ต้องเปิดบัญชีก่อนจึงเปลี่ยนอาจารย์ที่ปรึกษาได้',
        );
      }
      if (profile.advisorUserId === dto.advisorUserId) {
        throw new BadRequestException('ไม่มีข้อมูลที่เปลี่ยนแปลง');
      }
      if (dto.advisorUserId !== null) {
        await this.assertAssignableAdvisor(dto.advisorUserId, profile.userId, tx);
      }

      const updated = await tx.studentProfile.update({
        where: { id },
        data: { advisorUserId: dto.advisorUserId },
        include: { advisor: { select: { id: true, fullName: true, isActive: true } } },
      });
      await this.auditLogService.record(tx, {
        action: 'STUDENT_ADVISOR_UPDATE',
        actor: requester,
        targetType: 'StudentProfile',
        targetId: id,
        studentProfileId: id,
        programId: profile.programId,
        before: { advisorUserId: profile.advisorUserId },
        after: { advisorUserId: dto.advisorUserId },
      });
      return { id, advisor: updated.advisor };
    });
  }

  private async assertAssignableAdvisor(
    advisorUserId: string,
    studentUserId: string,
    tx: PrismaClientOrTx,
  ) {
    if (advisorUserId === studentUserId) {
      throw new BadRequestException('นิสิตเป็นอาจารย์ที่ปรึกษาของตัวเองไม่ได้');
    }
    const advisor = await tx.user.findFirst({
      where: { id: advisorUserId, isActive: true, userRoles: { some: { role: Role.INSTRUCTOR } } },
      select: { id: true },
    });
    if (!advisor) {
      throw new BadRequestException('ผู้ที่เลือกไม่ใช่อาจารย์ที่ใช้งานอยู่ในระบบ');
    }
  }

  // STAFF suspending or reactivating a student (ScopeGuard has checked the
  // program). Both switches move together: users.isActive stops sign-in at
  // once (the JWT strategies check it on every request), and
  // student_profiles.isActive is what the staff directory shows as suspended.
  // A pair that disagrees (older data) is brought back in line. Never deletes.
  async updateActiveStatus(
    id: string,
    dto: UpdateStudentActiveStatusDto,
    requester: RequestUser,
  ) {
    const reason = this.requireReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({
        where: { id },
        include: { user: { select: { isActive: true } } },
      });
      if (!profile) {
        throw new NotFoundException(`Student profile ${id} not found`);
      }
      const before = { profileActive: profile.isActive, userActive: profile.user.isActive };
      if (before.profileActive === dto.isActive && before.userActive === dto.isActive) {
        throw new ConflictException(
          dto.isActive ? 'บัญชีนิสิตนี้เปิดใช้งานอยู่แล้ว' : 'บัญชีนิสิตนี้ถูกระงับอยู่แล้ว',
        );
      }
      await tx.studentProfile.update({ where: { id }, data: { isActive: dto.isActive } });
      await tx.user.update({ where: { id: profile.userId }, data: { isActive: dto.isActive } });
      await this.auditLogService.record(tx, {
        action: dto.isActive ? 'STUDENT_REACTIVATE' : 'STUDENT_SUSPEND',
        actor: requester,
        targetType: 'StudentProfile',
        targetId: id,
        studentProfileId: id,
        programId: profile.programId,
        before,
        after: { profileActive: dto.isActive, userActive: dto.isActive },
        reason,
      });
      return { id, isActive: dto.isActive };
    });
  }

  // STAFF correcting a student's program, curriculum or admission year
  // (ScopeGuard has checked the current program; a new program must be in the
  // requester's scope too). The student code is never editable. A curriculum
  // change is refused while the student has grades or course assessments in
  // courses outside the new curriculum, since GPA, graduation checks and PLO
  // would silently be computed against the wrong curriculum; planned courses
  // outside it are dropped with the change (and counted in the audit row).
  async update(id: string, dto: UpdateStudentProfileDto, requester: RequestUser) {
    const reason = this.requireReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({ where: { id } });
      if (!profile) {
        throw new NotFoundException(`Student profile ${id} not found`);
      }
      if (!profile.isActive) {
        throw new ConflictException('บัญชีนิสิตนี้ถูกระงับอยู่ ต้องเปิดบัญชีก่อนจึงแก้ข้อมูลได้');
      }
      const next = {
        programId: dto.programId ?? profile.programId,
        curriculumId: dto.curriculumId ?? profile.curriculumId,
        admissionYear: dto.admissionYear ?? profile.admissionYear,
      };
      const changed = EDITABLE_FIELDS.filter((field) => next[field] !== profile[field]);
      if (changed.length === 0) {
        throw new BadRequestException('ไม่มีข้อมูลที่เปลี่ยนแปลง');
      }

      if (changed.includes('programId') || changed.includes('curriculumId')) {
        await this.validateProgramAndCurriculum(next.programId, next.curriculumId, tx);
      }
      if (changed.includes('programId')) {
        await this.assertProgramInScope(next.programId, requester);
      }

      let plannedCoursesRemoved = 0;
      if (changed.includes('curriculumId')) {
        const outsideNewCurriculum = { curriculumId: { not: next.curriculumId } };
        const [records, assessments] = await Promise.all([
          tx.studentCourseRecord.count({
            where: { studentProfileId: id, isActive: true, course: outsideNewCurriculum },
          }),
          tx.courseAssessment.count({
            where: { studentProfileId: id, course: outsideNewCurriculum },
          }),
        ]);
        if (records > 0 || assessments > 0) {
          throw new ConflictException(
            `เปลี่ยนหลักสูตรไม่ได้ เพราะนิสิตมีผลการเรียน ${records} รายวิชา และแบบประเมินรายวิชา ${assessments} รายการ ในวิชาที่ไม่อยู่ในหลักสูตรใหม่`,
          );
        }
        plannedCoursesRemoved = (
          await tx.studentPlannedCourse.deleteMany({
            where: { studentProfileId: id, course: outsideNewCurriculum },
          })
        ).count;
      }

      const before: AuditSnapshot = {};
      const after: AuditSnapshot = {};
      for (const field of changed) {
        before[field] = profile[field];
        after[field] = next[field];
      }
      if (plannedCoursesRemoved > 0) after.plannedCoursesRemoved = plannedCoursesRemoved;

      const updated = await tx.studentProfile.update({
        where: { id },
        data: {
          programId: next.programId,
          curriculumId: next.curriculumId,
          admissionYear: next.admissionYear,
        },
      });
      await this.auditLogService.record(tx, {
        action: 'STUDENT_PROFILE_UPDATE',
        actor: requester,
        targetType: 'StudentProfile',
        targetId: id,
        studentProfileId: id,
        programId: next.programId,
        before,
        after,
        reason,
      });
      return updated;
    });
  }

  // GET /student-profiles/:id/audit-logs (ScopeGuard has checked the program).
  findHistory(id: string) {
    return this.auditLogService.findForStudent(id);
  }

  private async assertProgramInScope(programId: string, requester: RequestUser) {
    const ancestry = await this.scopeResolverService.resolveAncestry('program', programId);
    const effectiveScopes = await this.scopeResolverService.getEffectiveScopes(
      requester.userId,
    );
    if (!this.scopeResolverService.isCovered(ancestry, effectiveScopes)) {
      throw new ForbiddenException('สาขาใหม่อยู่นอกขอบเขตของคุณ');
    }
  }

  private requireReason(reason: string): string {
    const trimmed = reason.trim();
    if (trimmed.length < REASON_MIN_LENGTH) {
      throw new BadRequestException(`กรุณาระบุเหตุผลอย่างน้อย ${REASON_MIN_LENGTH} ตัวอักษร`);
    }
    return trimmed;
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
