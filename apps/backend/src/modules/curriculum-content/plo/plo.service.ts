import { sortByPloCode } from '../../../common/util/plo-order.util';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Plo, Prisma } from '@prisma/client';
import { AuditLogService } from '../../../common/audit/audit-log.service';
import type { AuditSnapshot } from '../../../common/audit/audit-log.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { curriculumProgramId, ploSnapshot } from '../catalog-audit';
import { CreatePloDto } from './dto/create-plo.dto';
import { UpdatePloDto } from './dto/update-plo.dto';

@Injectable()
export class PloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreatePloDto, actor: RequestUser) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    await this.assertCodeAvailable(dto.curriculumId, dto.code);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.plo.create({ data: dto });
      await this.recordAudit(tx, actor, 'PLO_CREATE', created, null, ploSnapshot(created));
      return created;
    });
  }

  findAll() {
    return this.prisma.plo.findMany({ where: { isActive: true } }).then(sortByPloCode);
  }

  // Controller-facing reads, limited to the caller's curricula — see
  // CourseService.findAllInCurricula. `curriculumId` narrows to one curriculum.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput, curriculumId?: string) {
    return this.prisma.plo
      .findMany({
        where: { isActive: true, ...(curriculumId ? { curriculumId } : {}), curriculum },
      })
      .then(sortByPloCode);
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const plo = await this.prisma.plo.findFirst({
      where: { id, isActive: true, curriculum },
    });
    if (!plo) {
      throw new NotFoundException(`PLO ${id} not found`);
    }
    return plo;
  }

  async findOne(id: string) {
    const plo = await this.prisma.plo.findUnique({ where: { id } });
    if (!plo) {
      throw new NotFoundException(`PLO ${id} not found`);
    }
    return plo;
  }

  // Used by CloPloMappingService to validate a dependent relationship.
  async findActiveByIdOrThrow(id: string) {
    const plo = await this.prisma.plo.findUnique({ where: { id } });
    if (!plo || !plo.isActive) {
      throw new NotFoundException(`Active PLO ${id} not found`);
    }
    return plo;
  }

  // A deactivated PLO is a 404: editing it would change data nobody sees.
  async update(id: string, dto: UpdatePloDto, actor: RequestUser) {
    const current = await this.findActiveByIdOrThrow(id);

    if (dto.code) {
      await this.assertCodeAvailable(current.curriculumId, dto.code, id);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.plo.update({ where: { id }, data: dto });
      await this.recordAudit(
        tx,
        actor,
        'PLO_UPDATE',
        updated,
        ploSnapshot(current),
        ploSnapshot(updated),
      );
      return updated;
    });
  }

  async remove(id: string, actor: RequestUser) {
    const current = await this.findActiveByIdOrThrow(id);

    const activeMappingCount = await this.prisma.cloPloMapping.count({
      where: { ploId: id, isActive: true },
    });
    if (activeMappingCount > 0) {
      throw new ConflictException(
        `ลบ PLO นี้ไม่ได้ เพราะยังมีการเชื่อมโยงกับ CLO ${activeMappingCount} รายการ ให้ลบการเชื่อมโยงก่อน`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deactivated = await tx.plo.update({ where: { id }, data: { isActive: false } });
      await this.recordAudit(
        tx,
        actor,
        'PLO_DEACTIVATE',
        deactivated,
        ploSnapshot(current),
        ploSnapshot(deactivated),
      );
      return deactivated;
    });
  }

  private async recordAudit(
    tx: Prisma.TransactionClient,
    actor: RequestUser,
    action: AuditAction,
    plo: Plo,
    before: AuditSnapshot | null,
    after: AuditSnapshot,
  ) {
    await this.auditLogService.record(tx, {
      action,
      actor,
      targetType: 'Plo',
      targetId: plo.id,
      studentProfileId: null,
      programId: await curriculumProgramId(tx, plo.curriculumId),
      before,
      after,
    });
  }

  private async assertCodeAvailable(curriculumId: string, code: string, excludeId?: string) {
    const existing = await this.prisma.plo.findFirst({
      where: { curriculumId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`รหัส PLO "${code}" ถูกใช้แล้วในหลักสูตรนี้`);
    }
  }
}
