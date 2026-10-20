import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, CloPloMapping, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AuditSnapshot } from '../../../common/audit/audit-log.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { cloPloMappingSnapshot, curriculumProgramId } from '../catalog-audit';
import { CloService } from '../clo/clo.service';
import { CourseService } from '../course/course.service';
import { PloService } from '../plo/plo.service';
import { CreateCloPloMappingDto } from './dto/create-clo-plo-mapping.dto';
import { UpdateCloPloMappingDto } from './dto/update-clo-plo-mapping.dto';

@Injectable()
export class CloPloMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloService: CloService,
    private readonly ploService: PloService,
    private readonly courseService: CourseService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // A pair that was removed earlier is brought back with the new weight instead of
  // failing on the full-table unique (cloId, ploId); an active pair is a 409.
  async create(dto: CreateCloPloMappingDto, actor: RequestUser) {
    const clo = await this.cloService.findActiveByIdOrThrow(dto.cloId);
    const plo = await this.ploService.findActiveByIdOrThrow(dto.ploId);

    // Clo is two hops from Curriculum (Clo -> Course -> Curriculum), unlike
    // Course.category which is one hop — so this can't be enforced with a
    // compound FK trick and is checked here instead, same reasoning as
    // PrerequisiteService's cross-curriculum check.
    const course = await this.courseService.findActiveByIdOrThrow(clo.courseId);
    if (course.curriculumId !== plo.curriculumId) {
      throw new BadRequestException('CLO และ PLO ต้องอยู่ในหลักสูตรเดียวกัน');
    }

    const existing = await this.prisma.cloPloMapping.findUnique({
      where: { cloId_ploId: { cloId: dto.cloId, ploId: dto.ploId } },
    });
    if (existing?.isActive) {
      throw new ConflictException('CLO นี้เชื่อมโยงกับ PLO นี้อยู่แล้ว');
    }

    return this.prisma.$transaction(async (tx) => {
      if (existing) {
        const reactivated = await tx.cloPloMapping.update({
          where: { id: existing.id },
          data: { isActive: true, weight: dto.weight },
        });
        await this.recordAudit(
          tx,
          actor,
          'CLO_PLO_MAPPING_REACTIVATE',
          reactivated,
          plo.curriculumId,
          cloPloMappingSnapshot(existing),
          cloPloMappingSnapshot(reactivated),
        );
        return reactivated;
      }
      const created = await tx.cloPloMapping.create({ data: dto });
      await this.recordAudit(
        tx,
        actor,
        'CLO_PLO_MAPPING_CREATE',
        created,
        plo.curriculumId,
        null,
        cloPloMappingSnapshot(created),
      );
      return created;
    });
  }

  findAll() {
    return this.prisma.cloPloMapping.findMany({ where: { isActive: true } });
  }

  // Controller-facing reads, limited to the caller's curricula (a mapping's CLO
  // and PLO share one curriculum) — see CourseService.findAllInCurricula.
  // `curriculumId` narrows to one curriculum.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput, curriculumId?: string) {
    return this.prisma.cloPloMapping.findMany({
      where: {
        isActive: true,
        plo: { curriculum, ...(curriculumId ? { curriculumId } : {}) },
      },
    });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const mapping = await this.prisma.cloPloMapping.findFirst({
      where: { id, isActive: true, plo: { curriculum } },
    });
    if (!mapping) {
      throw new NotFoundException(`CLO-PLO mapping ${id} not found`);
    }
    return mapping;
  }

  async findOne(id: string) {
    const mapping = await this.prisma.cloPloMapping.findUnique({ where: { id } });
    if (!mapping) {
      throw new NotFoundException(`CLO-PLO mapping ${id} not found`);
    }
    return mapping;
  }

  private async findActiveOrThrow(id: string) {
    const mapping = await this.findOne(id);
    if (!mapping.isActive) {
      throw new NotFoundException(`CLO-PLO mapping ${id} not found`);
    }
    return mapping;
  }

  async update(id: string, dto: UpdateCloPloMappingDto, actor: RequestUser) {
    const current = await this.findActiveOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.cloPloMapping.update({ where: { id }, data: dto });
      await this.recordAudit(
        tx,
        actor,
        'CLO_PLO_MAPPING_UPDATE',
        updated,
        await this.curriculumIdOf(tx, updated),
        cloPloMappingSnapshot(current),
        cloPloMappingSnapshot(updated),
      );
      return updated;
    });
  }

  // Soft-delete (unlike Prerequisite) — see CONVENTIONS.md §7 note: this
  // mapping backs Achievement/PLO % calculations, so hard-deleting it would
  // make past dashboard values unreproducible.
  async remove(id: string, actor: RequestUser) {
    const current = await this.findActiveOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.cloPloMapping.update({
        where: { id },
        data: { isActive: false },
      });
      await this.recordAudit(
        tx,
        actor,
        'CLO_PLO_MAPPING_DEACTIVATE',
        deactivated,
        await this.curriculumIdOf(tx, deactivated),
        cloPloMappingSnapshot(current),
        cloPloMappingSnapshot(deactivated),
      );
      return deactivated;
    });
  }

  private async curriculumIdOf(tx: Prisma.TransactionClient, mapping: CloPloMapping) {
    const plo = await tx.plo.findUniqueOrThrow({
      where: { id: mapping.ploId },
      select: { curriculumId: true },
    });
    return plo.curriculumId;
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    mapping: CloPloMapping,
    curriculumId: string,
    before: AuditSnapshot | null,
    after: AuditSnapshot,
  ) {
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'CloPloMapping',
      targetId: mapping.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, curriculumId),
      before,
      after,
    });
  }
}
