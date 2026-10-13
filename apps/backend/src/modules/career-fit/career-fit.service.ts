import { Injectable } from '@nestjs/common';
import { Grade } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../auth/request-user.interface';
import { StudentCourseRecordService } from '../academic-record/student-course-record/student-course-record.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { computeCareerFit } from './career-fit.calculator';
import { CareerFitReportDto } from './career-fit-report.dto';

@Injectable()
export class CareerFitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
  ) {}

  // Own data only: the profile is resolved from the JWT user, never a param.
  async getMyCareerFit(user: RequestUser): Promise<CareerFitReportDto> {
    const profile = await this.studentProfileService.findByUserId(user.userId);

    const [careers, latestAttempts] = await Promise.all([
      this.prisma.career.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          courses: {
            where: {
              isActive: true,
              course: { isActive: true, curriculumId: profile.curriculumId },
            },
            include: { course: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      this.studentCourseRecordService.getLatestAttemptsPerCourse(profile.id),
    ]);

    const latestGrades = new Map<string, Grade>();
    for (const [courseId, attempt] of latestAttempts) {
      latestGrades.set(courseId, attempt.grade);
    }

    return computeCareerFit(
      careers
        .filter((c) => c.courses.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          sortOrder: c.sortOrder,
          courses: c.courses.map((cc) => ({
            weight: cc.weight,
            courseId: cc.course.id,
            code: cc.course.code,
            name: cc.course.name,
          })),
        })),
      latestGrades,
    );
  }
}
