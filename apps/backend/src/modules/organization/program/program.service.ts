import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { conflictOnReferenced } from '../../academic-record/semester/semester-references.util';
import {
  countProgramReferences,
  programBlockMessage,
  hasOrgReferences,
} from '../org-references.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { conflictOnDuplicate } from '../../../common/util/reactivate.util';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { DepartmentService } from '../department/department.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';

@Injectable()
export class ProgramService {
  private readonly logger = new Logger(ProgramService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentService: DepartmentService,
  ) {}

  async create(dto: CreateProgramDto) {
    await this.departmentService.findActiveByIdOrThrow(dto.departmentId);
    await this.assertNameAvailable(dto.departmentId, dto.name);
    await this.assertCodeAvailable(dto.departmentId, dto.code);
    return this.prisma.program.create({ data: dto });
  }

  findAll() {
    return this.prisma.program.findMany({ where: { isActive: true } });
  }

  async findOne(id: string) {
    const program = await this.prisma.program.findUnique({ where: { id } });
    if (!program) {
      throw new NotFoundException(`Program ${id} not found`);
    }
    return program;
  }

  // Used by CurriculumService and StudentProfileService to validate a
  // dependent relationship.
  async findActiveByIdOrThrow(id: string, tx: PrismaClientOrTx = this.prisma) {
    const program = await tx.program.findUnique({ where: { id } });
    if (!program || !program.isActive) {
      throw new NotFoundException(`Active program ${id} not found`);
    }
    return program;
  }

  async update(id: string, dto: UpdateProgramDto) {
    const { departmentId } = await this.findOne(id);

    if (dto.name) {
      await this.assertNameAvailable(departmentId, dto.name, id);
    }
    if (dto.code) {
      await this.assertCodeAvailable(departmentId, dto.code, id);
    }

    return this.prisma.program.update({ where: { id }, data: dto });
  }

  // `references` lets the screen disable "permanent delete" with a reason;
  // hardDelete re-checks.
  async findInactive() {
    const rows = await this.prisma.program.findMany({
      where: { isActive: false },
      orderBy: { code: 'asc' },
    });
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        references: await countProgramReferences(this.prisma, row.id),
      })),
    );
  }

  async reactivate(id: string) {
    const program = await this.findOne(id);
    if (program.isActive) {
      throw new ConflictException('สาขานี้เปิดใช้งานอยู่แล้ว');
    }
    const department = await this.departmentService.findOne(program.departmentId);
    if (!department.isActive) {
      throw new ConflictException(
        `เปิดใช้งานไม่ได้ เพราะภาควิชา "${department.name}" ยังปิดใช้งานอยู่ ให้เปิดภาควิชาก่อน`,
      );
    }
    const clashes = await Promise.all([
      this.prisma.program.findFirst({
        where: { departmentId: program.departmentId, code: program.code, isActive: true },
      }),
      this.prisma.program.findFirst({
        where: { departmentId: program.departmentId, name: program.name, isActive: true },
      }),
    ]);
    const message = 'เปิดใช้งานไม่ได้ เพราะรหัสหรือชื่อสาขานี้ถูกใช้โดยสาขาอื่นในภาควิชาเดียวกันที่ใช้งานอยู่แล้ว';
    if (clashes.some(Boolean)) throw new ConflictException(message);
    return conflictOnDuplicate(
      this.prisma.program.update({ where: { id }, data: { isActive: true } }),
      message,
    );
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeCurriculumCount = await this.prisma.curriculum.count({
      where: { programId: id, isActive: true },
    });
    if (activeCurriculumCount > 0) {
      throw new ConflictException(
        `Cannot deactivate program ${id}: ${activeCurriculumCount} active curriculum(a) still belong to it`,
      );
    }

    return this.prisma.program.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Permanent delete: only a deactivated สาขา that nothing points at. The count
  // and the delete share one transaction; a row inserted in between surfaces as
  // P2003 and is reported like the pre-check. The log carries ids and counts only.
  async hardDelete(id: string, actorId: string) {
    const program = await this.findOne(id);
    if (program.isActive) {
      throw new ConflictException('ลบถาวรได้เฉพาะสาขาที่ปิดใช้งานแล้ว');
    }
    await conflictOnReferenced(
      this.prisma.$transaction(async (tx) => {
        const refs = await countProgramReferences(tx, id);
        if (hasOrgReferences(refs)) throw new ConflictException(programBlockMessage(refs));
        await tx.program.delete({ where: { id } });
      }),
      'ลบถาวรไม่ได้ เพราะมีข้อมูลอ้างอิงสาขานี้เพิ่มขึ้นระหว่างดำเนินการ',
    );
    this.logger.warn(`Permanently deleted program ${id} by user ${actorId}`);
  }

  private async assertNameAvailable(
    departmentId: string,
    name: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.program.findFirst({
      where: { departmentId, name, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Program name "${name}" is already in use within this department`,
      );
    }
  }

  private async assertCodeAvailable(
    departmentId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.program.findFirst({
      where: { departmentId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Program code "${code}" is already in use within this department`,
      );
    }
  }
}
