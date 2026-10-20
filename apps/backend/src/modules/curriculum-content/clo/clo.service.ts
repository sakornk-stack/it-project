import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Clo, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AuditSnapshot } from '../../../common/audit/audit-log.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { cloSnapshot, curriculumProgramId } from '../catalog-audit';
import { CourseService } from '../course/course.service';
import { CreateCloDto } from './dto/create-clo.dto';
import { UpdateCloDto } from './dto/update-clo.dto';

@Injectable()
export class CloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courseService: CourseService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateCloDto, actor: RequestUser) {
    await this.courseService.findActiveByIdOrThrow(dto.courseId);
    await this.assertCodeAvailable(dto.courseId, dto.code);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.clo.create({ data: dto });
      await this.recordAudit(tx, actor, 'CLO_CREATE', created, null, cloSnapshot(created));
      return created;
    });
  }

  findAll() {
    return this.prisma.clo.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula — see
  // CourseService.findAllInCurricula. `courseId` narrows to one course.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput, courseId?: string) {
    return this.prisma.clo.findMany({
      where: { isActive: true, ...(courseId ? { courseId } : {}), course: { curriculum } },
    });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const clo = await this.prisma.clo.findFirst({
      where: { id, isActive: true, course: { curriculum } },
    });
    if (!clo) {
      throw new NotFoundException(`CLO ${id} not found`);
    }
    return clo;
  }

  async findOne(id: string) {
    const clo = await this.prisma.clo.findUnique({ where: { id } });
    if (!clo) {
      throw new NotFoundException(`CLO ${id} not found`);
    }
    return clo;
  }

  // Used by CloPloMappingService to validate a dependent relationship and
  // to resolve the course a CLO belongs to (for the cross-curriculum check).
  async findActiveByIdOrThrow(id: string) {
    const clo = await this.prisma.clo.findUnique({ where: { id } });
    if (!clo || !clo.isActive) {
      throw new NotFoundException(`Active CLO ${id} not found`);
    }
    return clo;
  }

  // A deactivated CLO is a 404: editing it would change data nobody sees.
  async update(id: string, dto: UpdateCloDto, actor: RequestUser) {
    const current = await this.findActiveByIdOrThrow(id);

    if (dto.code) {
      await this.assertCodeAvailable(current.courseId, dto.code, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.clo.update({ where: { id }, data: dto });
      await this.recordAudit(
        tx,
        actor,
        'CLO_UPDATE',
        updated,
        cloSnapshot(current),
        cloSnapshot(updated),
      );
      return updated;
    });
  }

  async remove(id: string, actor: RequestUser) {
    const current = await this.findActiveByIdOrThrow(id);

    const [mappings, scores] = await Promise.all([
      this.prisma.cloPloMapping.count({ where: { cloId: id, isActive: true } }),
      this.prisma.courseAssessmentCloScore.count({ where: { cloId: id } }),
    ]);
    const attached = [
      [mappings, 'การเชื่อมโยงกับ PLO'],
      [scores, 'คะแนนการประเมินรายวิชา'],
    ]
      .filter(([count]) => (count as number) > 0)
      .map(([count, label]) => `${label} ${count} รายการ`);
    if (attached.length > 0) {
      throw new ConflictException(
        `ลบ CLO นี้ไม่ได้ เพราะยังมีข้อมูลผูกอยู่: ${attached.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.clo.update({ where: { id }, data: { isActive: false } });
      await this.recordAudit(
        tx,
        actor,
        'CLO_DEACTIVATE',
        deactivated,
        cloSnapshot(current),
        cloSnapshot(deactivated),
      );
      return deactivated;
    });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    clo: Clo,
    before: AuditSnapshot | null,
    after: AuditSnapshot,
  ) {
    const course = await tx.course.findUniqueOrThrow({
      where: { id: clo.courseId },
      select: { curriculumId: true },
    });
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'Clo',
      targetId: clo.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, course.curriculumId),
      before,
      after,
    });
  }

  private async assertCodeAvailable(courseId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.clo.findFirst({
      where: { courseId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`รหัส CLO "${code}" ถูกใช้แล้วในวิชานี้`);
    }
  }
}
