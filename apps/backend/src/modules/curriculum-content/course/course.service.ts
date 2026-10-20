import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import { CourseCategoryService } from '../course-category/course-category.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CourseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly courseCategoryService: CourseCategoryService,
  ) {}

  async create(dto: CreateCourseDto) {
    await this.curriculumService.findActiveByIdOrThrow(dto.curriculumId);
    const category = await this.courseCategoryService.findActiveByIdOrThrow(
      dto.categoryId,
    );

    // The DB compound FK (curriculumId, categoryId) -> CourseCategory(curriculumId, id)
    // would reject a mismatch anyway, but checking here first gives a clear
    // error message instead of a raw Prisma foreign-key-violation.
    if (category.curriculumId !== dto.curriculumId) {
      throw new BadRequestException(
        `Course category ${dto.categoryId} does not belong to curriculum ${dto.curriculumId}`,
      );
    }

    await this.assertCodeAvailable(dto.curriculumId, dto.code);
    return this.prisma.course.create({ data: dto });
  }

  findAll() {
    return this.prisma.course.findMany({ where: { isActive: true } });
  }

  // Controller-facing read: only courses of the curricula the caller may see
  // (CatalogScopeService.curriculumWhere). findAll/findOne stay unscoped for
  // the other services that call them internally. A course outside the scope
  // is a 404, same as a missing or inactive one, so existence isn't leaked.
  findAllInCurricula(curriculum: Prisma.CurriculumWhereInput) {
    return this.prisma.course.findMany({ where: { isActive: true, curriculum } });
  }

  async findOneInCurricula(id: string, curriculum: Prisma.CurriculumWhereInput) {
    const course = await this.prisma.course.findFirst({
      where: { id, isActive: true, curriculum },
    });
    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }
    return course;
  }

  // For INSTRUCTOR self-service — "Course ที่ตัวเองรับผิดชอบ" (PROJECT_CONTEXT.md
  // §9). Query-level filter via the CourseInstructor join, same
  // never-fetch-all-then-filter shape as StudentCourseRecordService's
  // self-service branch (CONVENTIONS §3a).
  findMyCourses(userId: string) {
    return this.prisma.course.findMany({
      where: { isActive: true, instructors: { some: { userId } } },
    });
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }
    return course;
  }

  // Used by PrerequisiteService to validate a dependent relationship.
  async findActiveByIdOrThrow(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course || !course.isActive) {
      throw new NotFoundException(`Active course ${id} not found`);
    }
    return course;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const { curriculumId } = await this.findOne(id);

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

    if (dto.code) {
      await this.assertCodeAvailable(curriculumId, dto.code, id);
    }

    return this.prisma.course.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Direction 1: other courses depend on this one as a prerequisite —
    // block, same shape as the hierarchy soft-delete convention.
    const dependentCount = await this.prisma.prerequisite.count({
      where: { prerequisiteCourseId: id },
    });
    if (dependentCount > 0) {
      throw new ConflictException(
        `ปิดวิชานี้ไม่ได้ เพราะยังมีอีก ${dependentCount} วิชาที่กำหนดให้เป็นวิชาบังคับก่อน`,
      );
    }

    // Soft-delete never trips the Restrict FKs, so anything still attached is
    // checked here — and before the prerequisite cleanup below, which is a
    // hard delete that must not run when the course is kept.
    await this.assertNoAttachedData(id);

    // Direction 2: this course itself has prerequisite requirements
    // (courseId = id) — those rows become meaningless once this course is
    // deactivated, so they're cascade-deleted in the same transaction as
    // the soft-delete, atomically.
    return this.prisma.$transaction(async (tx) => {
      await tx.prerequisite.deleteMany({ where: { courseId: id } });

      return tx.course.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }

  // Only rows that can still be seen count: models with isActive are counted
  // active-only; CourseInstructor, CourseAssessment and StudentPlannedCourse
  // have no isActive, so every row counts.
  private async assertNoAttachedData(id: string) {
    const [records, instructors, clos, assessments, plans] =
      await Promise.all([
        this.prisma.studentCourseRecord.count({
          where: { courseId: id, isActive: true },
        }),
        this.prisma.courseInstructor.count({ where: { courseId: id } }),
        this.prisma.clo.count({ where: { courseId: id, isActive: true } }),
        this.prisma.courseAssessment.count({ where: { courseId: id } }),
        this.prisma.studentPlannedCourse.count({ where: { courseId: id } }),
      ]);

    const attached = [
      [records, 'ผลการเรียนของนิสิต'],
      [instructors, 'อาจารย์ผู้สอน'],
      [clos, 'CLO'],
      [assessments, 'การประเมินรายวิชา'],
      [plans, 'แผนการเรียนของนิสิต'],
    ]
      .filter(([count]) => (count as number) > 0)
      .map(([count, label]) => `${label} ${count} รายการ`);

    if (attached.length > 0) {
      throw new ConflictException(
        `ปิดวิชานี้ไม่ได้ เพราะยังมีข้อมูลผูกอยู่: ${attached.join(', ')}`,
      );
    }
  }

  private async assertCodeAvailable(
    curriculumId: string,
    code: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.course.findFirst({
      where: { curriculumId, code, isActive: true },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Course code "${code}" is already in use within this curriculum`,
      );
    }
  }
}
