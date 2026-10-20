import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prerequisite, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { curriculumProgramId, prerequisiteSnapshot } from '../catalog-audit';
import { CourseService } from '../course/course.service';
import { CreatePrerequisiteDto } from './dto/create-prerequisite.dto';
import { UpdatePrerequisiteDto } from './dto/update-prerequisite.dto';

@Injectable()
export class PrerequisiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreatePrerequisiteDto, actor: RequestUser) {
    if (dto.courseId === dto.prerequisiteCourseId) {
      throw new BadRequestException('A course cannot be its own prerequisite');
    }

    const course = await this.courseService.findActiveByIdOrThrow(
      dto.courseId,
    );
    const prerequisiteCourse = await this.courseService.findActiveByIdOrThrow(
      dto.prerequisiteCourseId,
    );

    // Prerequisite relationships are scoped to a single curriculum —
    // checked here at the service layer rather than a DB compound FK.
    if (course.curriculumId !== prerequisiteCourse.curriculumId) {
      throw new BadRequestException(
        `Course ${dto.courseId} and course ${dto.prerequisiteCourseId} do not belong to the same curriculum`,
      );
    }

    // The P2002 below aborts this transaction too, so the catch wraps it whole.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.prerequisite.create({ data: dto });
        await this.recordAudit(tx, actor, 'PREREQUISITE_CREATE', created, null, created);
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course ${dto.prerequisiteCourseId} is already a prerequisite of course ${dto.courseId}`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.prerequisite.findMany();
  }

  // Controller-facing read, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.prerequisite.findMany({ where: { course: { curriculum } } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const prerequisite = await this.prisma.prerequisite.findFirst({
      where: { id, course: { curriculum } },
    });
    if (!prerequisite) {
      throw new NotFoundException(`Prerequisite ${id} not found`);
    }
    return prerequisite;
  }

  async findOne(id: string) {
    const prerequisite = await this.prisma.prerequisite.findUnique({
      where: { id },
    });
    if (!prerequisite) {
      throw new NotFoundException(`Prerequisite ${id} not found`);
    }
    return prerequisite;
  }

  // Only groupId can change — courseId/prerequisiteCourseId identify the
  // row (see UpdatePrerequisiteDto).
  async update(id: string, dto: UpdatePrerequisiteDto, actor: RequestUser) {
    const current = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.prerequisite.update({ where: { id }, data: dto });
      await this.recordAudit(tx, actor, 'PREREQUISITE_UPDATE', updated, current, updated);
      return updated;
    });
  }

  // No soft-delete: Prerequisite is a mapping-style entity (like
  // UserRole/UserAuthMethod), not a hierarchy entity — CRUD directly.
  async remove(id: string, actor: RequestUser) {
    const current = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.prerequisite.delete({ where: { id } });
      await this.recordAudit(tx, actor, 'PREREQUISITE_DELETE', deleted, current, null);
      return deleted;
    });
  }

  // Both courses share one curriculum (checked on create), so the dependent
  // course's curriculum gives the program.
  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    target: Prerequisite,
    before: Prerequisite | null,
    after: Prerequisite | null,
  ) {
    const course = await tx.course.findUniqueOrThrow({
      where: { id: target.courseId },
      select: { curriculumId: true },
    });
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'Prerequisite',
      targetId: target.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, course.curriculumId),
      before: before && prerequisiteSnapshot(before),
      after: after && prerequisiteSnapshot(after),
    });
  }
}
