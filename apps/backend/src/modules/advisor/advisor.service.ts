import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditCheckerService } from '../academic-record/credit-checker/credit-checker.service';
import { StudentCourseRecordService } from '../academic-record/student-course-record/student-course-record.service';
import { PloAchievementService } from '../curriculum-content/plo-achievement/plo-achievement.service';
import { CreditCheckReport } from '../academic-record/credit-checker/credit-checker-report.interface';
import { SEMESTER_TERM_RANK } from '../academic-record/student-course-record/grade-point.constant';
import { RequestUser } from '../auth/request-user.interface';
import { AdviseeCourseRecord, AdviseeDetail, AdviseeSummary } from './advisor-report.interface';

const ADVISEE_INCLUDE = {
  user: { select: { fullName: true } },
  program: { select: { code: true, name: true } },
  curriculum: { select: { version: true, defaultAchievementThreshold: true } },
} satisfies Prisma.StudentProfileInclude;

type AdviseeRow = Prisma.StudentProfileGetPayload<{ include: typeof ADVISEE_INCLUDE }>;

// Read-only views of the students an INSTRUCTOR advises
// (student_profiles.advisorUserId = the caller). Ownership is a query filter
// (CONVENTIONS §3a): a student who is not the caller's advisee is a 404, the
// same as an unknown id. The figures come from the same service methods the
// student's own pages use, so the advisor sees the student's numbers.
@Injectable()
export class AdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
    private readonly creditCheckerService: CreditCheckerService,
    private readonly ploAchievementService: PloAchievementService,
  ) {}

  async listAdvisees(user: RequestUser): Promise<AdviseeSummary[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { advisorUserId: user.userId },
      include: ADVISEE_INCLUDE,
      orderBy: { studentCode: 'asc' },
    });
    // One curriculum tree per curriculum, shared by its students.
    const trees = new Map<string, ReturnType<CreditCheckerService['loadCurriculumTree']>>();
    return Promise.all(
      profiles.map(async (profile) => {
        if (!trees.has(profile.curriculumId)) {
          trees.set(
            profile.curriculumId,
            this.creditCheckerService.loadCurriculumTree(profile.curriculumId),
          );
        }
        const latest = await this.studentCourseRecordService.getLatestAttemptsPerCourse(
          profile.id,
        );
        const gpa = this.studentCourseRecordService.calculateGpaFromAttempts(latest);
        const credit = this.creditCheckerService.computeCreditCheck(
          profile,
          await trees.get(profile.curriculumId)!,
          latest,
        );
        return this.toSummary(profile, gpa.gpa, credit);
      }),
    );
  }

  async getAdvisee(id: string, user: RequestUser): Promise<AdviseeDetail> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id, advisorUserId: user.userId },
      include: ADVISEE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException(`Student profile ${id} not found`);
    }
    const [gpa, creditCheck, ploAchievement, records] = await Promise.all([
      this.studentCourseRecordService.calculateGpaForProfile(profile.id),
      this.creditCheckerService.checkCreditsForProfile(profile),
      this.ploAchievementService.calculateForProfile(profile),
      this.findRecords(profile.id),
    ]);
    return {
      student: this.toSummary(profile, gpa.gpa, creditCheck),
      gpa,
      records,
      creditCheck,
      ploAchievement,
      ploThreshold: profile.curriculum.defaultAchievementThreshold,
    };
  }

  private async findRecords(studentProfileId: string): Promise<AdviseeCourseRecord[]> {
    const rows = await this.prisma.studentCourseRecord.findMany({
      where: { studentProfileId, isActive: true },
      select: {
        id: true,
        grade: true,
        credits: true,
        course: { select: { id: true, code: true, name: true } },
        semester: { select: { id: true, term: true, academicYear: { select: { year: true } } } },
      },
    });
    return rows
      .map((row) => ({
        id: row.id,
        grade: row.grade,
        credits: row.credits,
        course: row.course,
        semesterId: row.semester.id,
        semesterTerm: row.semester.term,
        academicYear: row.semester.academicYear.year,
      }))
      .sort(
        (a, b) =>
          a.academicYear - b.academicYear ||
          SEMESTER_TERM_RANK[a.semesterTerm] - SEMESTER_TERM_RANK[b.semesterTerm] ||
          a.course.code.localeCompare(b.course.code),
      );
  }

  private toSummary(
    profile: AdviseeRow,
    gpa: number | null,
    credit: Pick<
      CreditCheckReport,
      'creditsAccumulated' | 'totalCreditsRequired' | 'graduationReadiness'
    >,
  ): AdviseeSummary {
    return {
      id: profile.id,
      studentCode: profile.studentCode,
      fullName: profile.user.fullName,
      programCode: profile.program.code,
      programName: profile.program.name,
      curriculumVersion: profile.curriculum.version,
      admissionYear: profile.admissionYear,
      isActive: profile.isActive,
      gpa,
      creditsAccumulated: credit.creditsAccumulated,
      totalCreditsRequired: credit.totalCreditsRequired,
      graduationReady: credit.graduationReadiness.isReady,
    };
  }
}
