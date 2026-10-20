import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, CourseCategory, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { courseCategorySnapshot, curriculumProgramId } from '../catalog-audit';
import { CreateCourseCategoryDto } from './dto/create-course-category.dto';
import { UpdateCourseCategoryDto } from './dto/update-course-category.dto';

@Injectable()
export class CourseCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateCourseCategoryDto, actor: RequestUser) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    await this.assertNameAvailable(dto.curriculumId, dto.name);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.courseCategory.create({ data: dto });
      await this.recordAudit(tx, actor, 'COURSE_CATEGORY_CREATE', created, null);
      return created;
    });
  }

  findAll() {
    return this.prisma.courseCategory.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula — see
  // CourseService.findAllInCurricula.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.courseCategory.findMany({ where: { isActive: true, curriculum } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const category = await this.prisma.courseCategory.findFirst({
      where: { id, isActive: true, curriculum },
    });
    if (!category) {
      throw new NotFoundException(`Course category ${id} not found`);
    }
    return category;
  }

  async findOne(id: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Course category ${id} not found`);
    }
    return category;
  }

  // Used by CourseService and CurriculumRequirementService to validate a
  // dependent relationship.
  async findActiveByIdOrThrow(id: string) {
    const category = await this.prisma.courseCategory.findUnique({
      where: { id },
    });
    if (!category || !category.isActive) {
      throw new NotFoundException(`Active course category ${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCourseCategoryDto, actor: RequestUser) {
    const current = await this.findOne(id);

    if (dto.name) {
      await this.assertNameAvailable(current.curriculumId, dto.name, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.courseCategory.update({ where: { id }, data: dto });
      await this.recordAudit(tx, actor, 'COURSE_CATEGORY_UPDATE', updated, current);
      return updated;
    });
  }

  async remove(id: string, actor: RequestUser) {
    const current = await this.findOne(id);

    const activeCourseCount = await this.prisma.course.count({
      where: { categoryId: id, isActive: true },
    });
    if (activeCourseCount > 0) {
      throw new ConflictException(
        `Cannot deactivate course category ${id}: ${activeCourseCount} active course(s) still belong to it`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.courseCategory.update({
        where: { id },
        data: { isActive: false },
      });
      await this.recordAudit(tx, actor, 'COURSE_CATEGORY_DEACTIVATE', deactivated, current);
      return deactivated;
    });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    after: CourseCategory,
    before: CourseCategory | null,
  ) {
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'CourseCategory',
      targetId: after.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, after.curriculumId),
      before: before && courseCategorySnapshot(before),
      after: courseCategorySnapshot(after),
    });
  }

  private async assertNameAvailable(
    curriculumId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.courseCategory.findFirst({
      where: { curriculumId, name, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Course category name "${name}" is already in use within this curriculum`,
      );
    }
  }
}
