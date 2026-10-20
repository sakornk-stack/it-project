import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, CurriculumRequirement, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { curriculumProgramId, curriculumRequirementSnapshot } from '../catalog-audit';
import { CourseCategoryService } from '../course-category/course-category.service';
import { CreateCurriculumRequirementDto } from './dto/create-curriculum-requirement.dto';
import { UpdateCurriculumRequirementDto } from './dto/update-curriculum-requirement.dto';

@Injectable()
export class CurriculumRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly courseCategoryService: CourseCategoryService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateCurriculumRequirementDto, actor: RequestUser) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    const category = await this.courseCategoryService.findActiveByIdOrThrow(
      dto.categoryId,
    );

    if (category.curriculumId !== dto.curriculumId) {
      throw new BadRequestException(
        `Course category ${dto.categoryId} does not belong to curriculum ${dto.curriculumId}`,
      );
    }

    // The P2002 below aborts this transaction too, so the catch wraps it whole.
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.curriculumRequirement.create({ data: dto });
        await this.recordAudit(tx, actor, 'CURRICULUM_REQUIREMENT_CREATE', created, null, created);
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course category ${dto.categoryId} already has a curriculum requirement`,
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.curriculumRequirement.findMany();
  }

  // Controller-facing read, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.curriculumRequirement.findMany({ where: { curriculum } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const requirement = await this.prisma.curriculumRequirement.findFirst({
      where: { id, curriculum },
    });
    if (!requirement) {
      throw new NotFoundException(`Curriculum requirement ${id} not found`);
    }
    return requirement;
  }

  async findOne(id: string) {
    const requirement = await this.prisma.curriculumRequirement.findUnique({
      where: { id },
    });
    if (!requirement) {
      throw new NotFoundException(`Curriculum requirement ${id} not found`);
    }
    return requirement;
  }

  async update(id: string, dto: UpdateCurriculumRequirementDto, actor: RequestUser) {
    const requirement = await this.findOne(id);
    const { curriculumId } = requirement;

    if (dto.categoryId) {
      const category = await this.courseCategoryService.findActiveByIdOrThrow(
        dto.categoryId,
      );
      if (category.curriculumId !== curriculumId) {
        throw new BadRequestException(
          `Course category ${dto.categoryId} does not belong to curriculum ${curriculumId}`,
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.curriculumRequirement.update({
          where: { id },
          data: dto,
        });
        await this.recordAudit(
          tx,
          actor,
          'CURRICULUM_REQUIREMENT_UPDATE',
          updated,
          requirement,
          updated,
        );
        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Course category ${dto.categoryId} already has a curriculum requirement`,
        );
      }
      throw error;
    }
  }

  // No soft-delete: CurriculumRequirement is a mapping-style entity (like
  // UserRole/UserAuthMethod), not a hierarchy entity — CRUD directly.
  async remove(id: string, actor: RequestUser) {
    const requirement = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.curriculumRequirement.delete({ where: { id } });
      await this.recordAudit(
        tx,
        actor,
        'CURRICULUM_REQUIREMENT_DELETE',
        deleted,
        requirement,
        null,
      );
      return deleted;
    });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    target: CurriculumRequirement,
    before: CurriculumRequirement | null,
    after: CurriculumRequirement | null,
  ) {
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'CurriculumRequirement',
      targetId: target.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, target.curriculumId),
      before: before && curriculumRequirementSnapshot(before),
      after: after && curriculumRequirementSnapshot(after),
    });
  }
}
