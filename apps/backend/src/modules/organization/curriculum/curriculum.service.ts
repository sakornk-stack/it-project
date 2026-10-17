import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { conflictOnDuplicate } from '../../../common/util/reactivate.util';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { ProgramService } from '../program/program.service';
import { CreateCurriculumDto } from './dto/create-curriculum.dto';
import { UpdateCurriculumDto } from './dto/update-curriculum.dto';

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programService: ProgramService,
  ) {}

  async create(dto: CreateCurriculumDto) {
    await this.programService.findActiveByIdOrThrow(dto.programId);
    await this.assertVersionAvailable(dto.programId, dto.version);

    if (dto.isOpenForRegistration) {
      return this.prisma.$transaction(async (tx) => {
        await this.unsetOtherOpenCurricula(tx, dto.programId);
        return tx.curriculum.create({ data: dto });
      });
    }

    return this.prisma.curriculum.create({ data: dto });
  }

  findAll() {
    return this.prisma.curriculum.findMany({ where: { isActive: true } });
  }

  async findOne(id: string) {
    const curriculum = await this.prisma.curriculum.findUnique({
      where: { id },
    });
    if (!curriculum) {
      throw new NotFoundException(`Curriculum ${id} not found`);
    }
    return curriculum;
  }

  // Used by StudentProfileService to validate a dependent relationship.
  async findActiveByIdOrThrow(
    id: string,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    const curriculum = await tx.curriculum.findUnique({
      where: { id },
    });
    if (!curriculum || !curriculum.isActive) {
      throw new NotFoundException(`Active curriculum ${id} not found`);
    }
    return curriculum;
  }

  async update(id: string, dto: UpdateCurriculumDto) {
    const { programId } = await this.findOne(id);

    if (dto.version) {
      await this.assertVersionAvailable(programId, dto.version, id);
    }

    if (dto.isOpenForRegistration) {
      return this.prisma.$transaction(async (tx) => {
        await this.unsetOtherOpenCurricula(tx, programId, id);
        return tx.curriculum.update({ where: { id }, data: dto });
      });
    }

    return this.prisma.curriculum.update({ where: { id }, data: dto });
  }

  findInactive() {
    return this.prisma.curriculum.findMany({
      where: { isActive: false },
      orderBy: [{ programId: 'asc' }, { version: 'asc' }],
    });
  }

  // What the ADMIN list shows: only the curricula of programs the caller's
  // scopes cover (an empty scope matches nothing).
  findInactiveInPrograms(programIds: string[]) {
    return this.prisma.curriculum.findMany({
      where: { isActive: false, programId: { in: programIds } },
      orderBy: [{ programId: 'asc' }, { version: 'asc' }],
    });
  }

  // Comes back closed to registration: a program may have only one curriculum open
  // at a time, and reopening is a separate, confirmed step on the curriculum itself.
  async reactivate(id: string) {
    const curriculum = await this.findOne(id);
    if (curriculum.isActive) {
      throw new ConflictException('หลักสูตรนี้เปิดใช้งานอยู่แล้ว');
    }
    const program = await this.programService.findOne(curriculum.programId);
    if (!program.isActive) {
      throw new ConflictException(
        `เปิดใช้งานไม่ได้ เพราะสาขา "${program.name}" ยังปิดใช้งานอยู่ ให้เปิดสาขาก่อน`,
      );
    }
    const message = `เปิดใช้งานไม่ได้ เพราะฉบับหลักสูตร "${curriculum.version}" ถูกใช้โดยหลักสูตรอื่นในสาขานี้ที่ใช้งานอยู่แล้ว`;
    const clash = await this.prisma.curriculum.findFirst({
      where: { programId: curriculum.programId, version: curriculum.version, isActive: true },
    });
    if (clash) throw new ConflictException(message);
    return conflictOnDuplicate(
      this.prisma.curriculum.update({
        where: { id },
        data: { isActive: true, isOpenForRegistration: false },
      }),
      message,
    );
  }

  // Leaf of the org hierarchy, but student profiles and curriculum content
  // still reference it — block deactivation while any of those are active.
  async remove(id: string) {
    await this.findOne(id);

    const where = { curriculumId: id, isActive: true };
    const [students, courses, plos, categories] = await Promise.all([
      this.prisma.studentProfile.count({ where }),
      this.prisma.course.count({ where }),
      this.prisma.plo.count({ where }),
      this.prisma.courseCategory.count({ where }),
    ]);
    if (students + courses + plos + categories > 0) {
      throw new ConflictException(
        `Cannot deactivate curriculum ${id}: ${students} active student profile(s), ${courses} course(s), ${plos} PLO(s), ${categories} course categor(ies) still belong to it`,
      );
    }

    return this.prisma.curriculum.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async assertVersionAvailable(
    programId: string,
    version: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.curriculum.findFirst({
      where: { programId, version, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Curriculum version "${version}" is already in use within this program`,
      );
    }
  }

  // isOpenForRegistration conflict rule (auto-unset, not reject): setting
  // one Curriculum to isOpenForRegistration = true must unset every other
  // Curriculum under the same programId that currently has
  // isOpenForRegistration = true, in the same transaction as the write
  // that sets it — so the two updates commit or roll back together and a
  // program is never left with zero or two curricula open for
  // registration at once.
  // Future: Phase 13 (Audit) should log this auto-unset as its own audit
  // entry, separate from the primary update, since it is a system-driven
  // side effect rather than a direct user action on that row.
  private async unsetOtherOpenCurricula(
    tx: Prisma.TransactionClient,
    programId: string,
    excludeId?: string,
  ) {
    await tx.curriculum.updateMany({
      where: {
        programId,
        isOpenForRegistration: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isOpenForRegistration: false },
    });
  }
}
