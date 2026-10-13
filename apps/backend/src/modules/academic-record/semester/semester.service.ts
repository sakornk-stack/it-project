import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { conflictOnDuplicate } from '../../../common/util/reactivate.util';
import { AcademicYearService } from '../academic-year/academic-year.service';
import {
  conflictOnReferenced,
  countSemesterReferences,
  hasReferences,
  referencesBlockMessage,
} from './semester-references.util';
import { CreateSemesterDto } from './dto/create-semester.dto';
import { UpdateSemesterDto } from './dto/update-semester.dto';

@Injectable()
export class SemesterService {
  private readonly logger = new Logger(SemesterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly academicYearService: AcademicYearService,
  ) {}

  async create(dto: CreateSemesterDto) {
    await this.academicYearService.findActiveByIdOrThrow(dto.academicYearId);
    await this.assertTermAvailable(dto.academicYearId, dto.term);
    return this.prisma.semester.create({ data: dto });
  }

  findAll() {
    return this.prisma.semester.findMany({ where: { isActive: true } });
  }

  async findOne(id: string) {
    const semester = await this.prisma.semester.findUnique({ where: { id } });
    if (!semester) {
      throw new NotFoundException(`Semester ${id} not found`);
    }
    return semester;
  }

  // Used by StudentCourseRecordService to validate a dependent relationship.
  async findActiveByIdOrThrow(id: string) {
    const semester = await this.prisma.semester.findUnique({ where: { id } });
    if (!semester || !semester.isActive) {
      throw new NotFoundException(`Active semester ${id} not found`);
    }
    return semester;
  }

  async update(id: string, dto: UpdateSemesterDto) {
    const semester = await this.findOne(id);

    if (dto.academicYearId) {
      await this.academicYearService.findActiveByIdOrThrow(dto.academicYearId);
    }
    const academicYearId = dto.academicYearId ?? semester.academicYearId;

    if (dto.term) {
      await this.assertTermAvailable(academicYearId, dto.term, id);
    }

    return this.prisma.semester.update({ where: { id }, data: dto });
  }

  // `references` lets the screen disable "permanent delete" with a reason
  // before the user tries; hardDelete re-checks regardless.
  async findInactive() {
    const semesters = await this.prisma.semester.findMany({
      where: { isActive: false },
      orderBy: [{ academicYearId: 'asc' }, { term: 'asc' }],
    });
    const counts = await countSemesterReferences(
      this.prisma,
      semesters.map((s) => s.id),
    );
    return semesters.map((s) => ({ ...s, references: counts.get(s.id)! }));
  }

  async reactivate(id: string) {
    const semester = await this.findOne(id);
    if (semester.isActive) {
      throw new ConflictException('ภาคเรียนนี้เปิดใช้งานอยู่แล้ว');
    }
    const academicYear = await this.academicYearService.findOne(semester.academicYearId);
    if (!academicYear.isActive) {
      throw new ConflictException(
        `เปิดใช้งานไม่ได้ เพราะปีการศึกษา ${academicYear.year} ยังปิดใช้งานอยู่ ให้เปิดปีการศึกษาก่อน`,
      );
    }
    const message = 'เปิดใช้งานไม่ได้ เพราะภาคเรียนนี้มีอยู่แล้วในปีการศึกษาเดียวกันและใช้งานอยู่';
    const clash = await this.prisma.semester.findFirst({
      where: { academicYearId: semester.academicYearId, term: semester.term, isActive: true },
    });
    if (clash) throw new ConflictException(message);
    return conflictOnDuplicate(
      this.prisma.semester.update({ where: { id }, data: { isActive: true } }),
      message,
    );
  }

  async remove(id: string) {
    await this.findOne(id);

    // StudentCourseRecord is hard-delete (no isActive), so every row
    // referencing this semester counts as "still depends on it" — unlike
    // the isActive-scoped counts used elsewhere in the hierarchy.
    const recordCount = await this.prisma.studentCourseRecord.count({
      where: { semesterId: id },
    });
    if (recordCount > 0) {
      throw new ConflictException(
        `Cannot deactivate semester ${id}: ${recordCount} student course record(s) still reference it`,
      );
    }

    return this.prisma.semester.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Permanent delete: only a deactivated semester that nothing references.
  async hardDelete(id: string, actorId: string) {
    const semester = await this.findOne(id);
    if (semester.isActive) {
      throw new ConflictException('ลบถาวรได้เฉพาะภาคเรียนที่ปิดใช้งานแล้ว');
    }

    await conflictOnReferenced(
      this.prisma.$transaction(async (tx) => {
        const refs = (await countSemesterReferences(tx, [id])).get(id)!;
        if (hasReferences(refs)) {
          throw new ConflictException(referencesBlockMessage('ภาคเรียนนี้', refs));
        }
        await tx.semester.delete({ where: { id } });
      }),
      'ลบถาวรไม่ได้ เพราะมีข้อมูลอ้างอิงภาคเรียนนี้เพิ่มขึ้นระหว่างดำเนินการ',
    );
    this.logger.warn(
      `Permanently deleted semester ${id} (${semester.term}, year ${semester.academicYearId}) by user ${actorId}`,
    );
  }

  private async assertTermAvailable(
    academicYearId: string,
    term: CreateSemesterDto['term'],
    excludeId?: string,
  ) {
    const existing = await this.prisma.semester.findFirst({
      where: { academicYearId, term, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Semester "${term}" is already in use within this academic year`,
      );
    }
  }
}
