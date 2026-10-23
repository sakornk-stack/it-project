import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentProfileService } from '../../users/student-profile/student-profile.service';
import { CourseService } from '../course/course.service';
import { CreateCourseAssessmentDto } from './dto/create-course-assessment.dto';
import { UpdateCourseAssessmentDto } from './dto/update-course-assessment.dto';

@Injectable()
export class CourseAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly courseService: CourseService,
  ) {}

  // Always self-service — a Course Assessment is inherently the student's
  // own reflection, never something SUPER_ADMIN submits on their behalf
  // (unlike StudentCourseRecord's dual-mode create).
  async create(dto: CreateCourseAssessmentDto, user: RequestUser) {
    const studentProfile = await this.studentProfileService.findByUserId(
      user.userId,
    );
    await this.courseService.findActiveByIdOrThrow(dto.courseId);

    // "หลังเรียน Course แล้ว" — reuses StudentCourseRecord's existence as
    // the "has taken this course" signal; no separate enrollment concept
    // exists anywhere else in this schema. Active records only: a deleted
    // record no longer counts as taken (same rule as assessableCourseIds).
    const hasTaken = await this.prisma.studentCourseRecord.findFirst({
      where: {
        studentProfileId: studentProfile.id,
        courseId: dto.courseId,
        isActive: true,
      },
    });
    if (!hasTaken) {
      throw new BadRequestException(
        `You have not taken course ${dto.courseId} yet`,
      );
    }

    await this.assertClosBelongToCourse(
      dto.courseId,
      dto.cloScores.map((s) => s.cloId),
    );

    try {
      return await this.prisma.courseAssessment.create({
        data: {
          studentProfileId: studentProfile.id,
          courseId: dto.courseId,
          comment: dto.comment,
          cloScores: {
            create: dto.cloScores.map((s) => ({ cloId: s.cloId, score: s.score })),
          },
        },
        include: { cloScores: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `You have already submitted an assessment for course ${dto.courseId} — use PATCH to revise it`,
        );
      }
      throw error;
    }
  }

  async findOwn(courseId: string, user: RequestUser) {
    const studentProfile = await this.studentProfileService.findByUserId(
      user.userId,
    );
    const assessment = await this.prisma.courseAssessment.findUnique({
      where: {
        studentProfileId_courseId: {
          studentProfileId: studentProfile.id,
          courseId,
        },
      },
      include: { cloScores: true },
    });
    if (!assessment) {
      throw new NotFoundException(`No assessment found for course ${courseId}`);
    }
    return assessment;
  }

  async findAllOwn(user: RequestUser) {
    const studentProfile = await this.studentProfileService.findByUserId(
      user.userId,
    );
    const [assessments, pendingAssessmentCount, assessableCourseCount] =
      await Promise.all([
        this.prisma.courseAssessment.findMany({
          where: { studentProfileId: studentProfile.id },
          include: { cloScores: true },
        }),
        this.countPendingForStudent(studentProfile.id),
        this.countAssessableCourses(studentProfile.id),
      ]);
    return { assessments, assessableCourseCount, pendingAssessmentCount };
  }

  // Assessable = a course the student has taken (active record, retakes
  // collapse to one via distinct) that has at least one active CLO — the
  // same rule the academic-record timeline applies. Caller must have
  // already validated studentProfileId belongs to the requester.
  private async assessableCourseIds(studentProfileId: string) {
    const records = await this.prisma.studentCourseRecord.findMany({
      where: {
        studentProfileId,
        isActive: true,
        course: { isActive: true, clos: { some: { isActive: true } } },
      },
      distinct: ['courseId'],
      select: { courseId: true },
    });
    return records.map((r) => r.courseId);
  }

  private async countAssessableCourses(studentProfileId: string) {
    return (await this.assessableCourseIds(studentProfileId)).length;
  }

  async countPendingForStudent(studentProfileId: string) {
    const courseIds = await this.assessableCourseIds(studentProfileId);
    if (courseIds.length === 0) return 0;
    const assessed = await this.prisma.courseAssessment.count({
      where: { studentProfileId, courseId: { in: courseIds } },
    });
    return courseIds.length - assessed;
  }

  async update(id: string, dto: UpdateCourseAssessmentDto, user: RequestUser) {
    const existing = await this.findOwnById(id, user);

    await this.assertClosBelongToCourse(
      existing.courseId,
      dto.cloScores.map((s) => s.cloId),
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.courseAssessmentCloScore.deleteMany({
        where: { courseAssessmentId: id },
      });
      await tx.courseAssessmentCloScore.createMany({
        data: dto.cloScores.map((s) => ({
          courseAssessmentId: id,
          cloId: s.cloId,
          score: s.score,
        })),
      });
      return tx.courseAssessment.update({
        where: { id },
        data: { comment: dto.comment },
        include: { cloScores: true },
      });
    });
  }

  async remove(id: string, user: RequestUser) {
    await this.findOwnById(id, user);
    return this.prisma.courseAssessment.delete({ where: { id } });
  }

  // INSTRUCTOR/ADMIN/SUPER_ADMIN aggregate view — numeric only, no
  // individual comments or student identity (see plan for rationale).
  async getAggregateForCourse(courseId: string) {
    await this.courseService.findActiveByIdOrThrow(courseId);

    const clos = await this.prisma.clo.findMany({
      where: { courseId, isActive: true },
      orderBy: { code: 'asc' },
    });
    const scores = await this.prisma.courseAssessmentCloScore.findMany({
      where: { clo: { courseId } },
    });
    const submissionCount = await this.prisma.courseAssessment.count({
      where: { courseId },
    });

    const cloAverages = clos.map((clo) => {
      const cloScores = scores.filter((s) => s.cloId === clo.id);
      const averageScore =
        cloScores.length > 0
          ? cloScores.reduce((sum, s) => sum + s.score, 0) / cloScores.length
          : null;
      return {
        cloId: clo.id,
        code: clo.code,
        averageScore,
        scoreCount: cloScores.length,
      };
    });

    return { courseId, submissionCount, clos: cloAverages };
  }

  // Same-exception-for-both-cases shape as StudentCourseRecordService
  // (CONVENTIONS §3a) — "doesn't exist" and "exists but isn't yours" are
  // indistinguishable.
  private async findOwnById(id: string, user: RequestUser) {
    const studentProfile = await this.studentProfileService.findByUserId(
      user.userId,
    );
    const existing = await this.prisma.courseAssessment.findFirst({
      where: { id, studentProfileId: studentProfile.id },
    });
    if (!existing) {
      throw new NotFoundException(`Course assessment ${id} not found`);
    }
    return existing;
  }

  private async assertClosBelongToCourse(courseId: string, cloIds: string[]) {
    const clos = await this.prisma.clo.findMany({
      where: { id: { in: cloIds }, courseId },
      select: { id: true },
    });
    if (clos.length !== new Set(cloIds).size) {
      throw new BadRequestException(
        'One or more CLOs do not belong to this course',
      );
    }
  }
}
