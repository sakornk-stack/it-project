import { Injectable } from '@nestjs/common';
import { Clo, Course, Grade, Prisma, StudentProfile } from '@prisma/client';
import { RequestUser } from '../auth/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ScopeResolverService } from '../../common/scope/scope-resolver.service';
import { AcademicYearService } from '../academic-record/academic-year/academic-year.service';
import {
  CreditCheckCurriculumTree,
  CreditCheckerService,
} from '../academic-record/credit-checker/credit-checker.service';
import { LearningPathService } from '../academic-record/learning-path/learning-path.service';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from '../academic-record/student-course-record/student-course-record.service';
import {
  CRITICAL_GRADES,
  RiskLevel,
  SEMESTER_TERM_RANK,
  gpaRiskLevel,
  riskLevel,
} from '../academic-record/student-course-record/grade-point.constant';
import { buildGpaTrend } from '../academic-record/student-course-record/gpa-trend';
import { CloAchievementService } from '../curriculum-content/clo-achievement/clo-achievement.service';
import { CourseAssessmentService } from '../curriculum-content/course-assessment/course-assessment.service';
import { CourseService } from '../curriculum-content/course/course.service';
import {
  PloAchievementService,
  PloWithMappings,
} from '../curriculum-content/plo-achievement/plo-achievement.service';
import {
  AdminScopeCurriculumEntry,
  AdminScopeOverviewReport,
  CurriculumDashboardReport,
  CurriculumDataState,
  InstructorCourseSummary,
  InstructorCourseTimelineReport,
  InstructorDashboardReport,
  InstructorStudentEntry,
  InstructorStudentsReport,
  InstructorYearLevelsReport,
  ProblematicCloEntry,
  ProblematicPloEntry,
  RecentCourse,
  StaffAtRiskStudent,
  StaffOverviewCurriculum,
  StaffOverviewReport,
  StaffStudentRiskEntry,
  StaffYearLevelsReport,
  StudentDashboardReport,
  SystemCurriculumEntry,
  SystemCurriculumOverviewReport,
  YearLevelBucket,
  YearLevelStudent,
} from './dashboard-report.interface';
import {
  expectedCreditsByNow,
  OnTrackStatus,
  resolveOnTrackStatus,
  resolveYearLevel,
} from '../../common/academic/year-level';
import { creditProgressPercent } from '../../common/academic/credit-progress';
import { RadarPoint } from '../curriculum-content/plo-achievement/plo-achievement-report.interface';

const RECENT_COURSES_LIMIT = 5;
// The dashboard card is a prompt to act, not a register. The directory
// carries the full list, filtered by risk.
const STAFF_AT_RISK_LIMIT = 20;
// Bucket 4 is a catch-all "4 and beyond" band, not a literal 4th year —
// keeps the UI to a fixed set of buckets regardless of how long a
// student has actually been enrolled.
const YEAR_LEVEL_LABELS: Record<number, string> = {
  1: 'ปี 1',
  2: 'ปี 2',
  3: 'ปี 3',
  4: 'ปี 4 ขึ้นไป',
};

type CurriculumWithProgram = Prisma.CurriculumGetPayload<{
  include: {
    program: {
      select: {
        code: true;
        name: true;
        department: { select: { name: true; faculty: { select: { name: true } } } };
      };
    };
  };
}>;

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const group = grouped.get(key(item));
    if (group) {
      group.push(item);
    } else {
      grouped.set(key(item), [item]);
    }
  }
  return grouped;
}

// A curriculum with courses but no students is mid-setup, not failing.
// Treating both as "0%" is what makes an untouched dashboard look broken.
function resolveDataState(
  studentCount: number,
  courseCount: number,
  ploCount: number,
): CurriculumDataState {
  if (studentCount > 0) return 'HAS_STUDENTS';
  if (courseCount > 0 || ploCount > 0) return 'STRUCTURE_ONLY';
  return 'EMPTY';
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly creditCheckerService: CreditCheckerService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
    private readonly ploAchievementService: PloAchievementService,
    private readonly learningPathService: LearningPathService,
    private readonly courseService: CourseService,
    private readonly cloAchievementService: CloAchievementService,
    private readonly courseAssessmentService: CourseAssessmentService,
    private readonly prisma: PrismaService,
    private readonly scopeResolverService: ScopeResolverService,
    private readonly academicYearService: AcademicYearService,
  ) {}

  async getStudentDashboard(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<StudentDashboardReport> {
    // Self-ownership enforced here — every call below either reuses this
    // validation (getLatestAttemptsPerCourse takes no ownership check of
    // its own, by design) or independently re-validates the same way
    // (calculateGpa, calculateForStudent, getLearningPath), never a
    // second implementation of the check itself.
    const creditCheck = await this.creditCheckerService.checkCredits(
      studentProfileId,
      user,
    );
    const gpaResult = await this.studentCourseRecordService.calculateGpa(
      studentProfileId,
      user,
    );
    const ploReport = await this.ploAchievementService.calculateForStudent(
      studentProfileId,
      user,
    );
    const learningPath = await this.learningPathService.getLearningPath(
      studentProfileId,
      user,
    );
    const latestByCourse =
      await this.studentCourseRecordService.getLatestAttemptsPerCourse(
        studentProfileId,
      );

    // Lookup for code/name/credits — reuses data checkCredits already
    // fetched (every course the curriculum knows about, cross-referenced
    // with this student's attempts) rather than issuing new queries.
    const courseInfoById = new Map(
      [
        ...creditCheck.passedCourses,
        ...creditCheck.failedCourses,
        ...creditCheck.notYetStudiedCourses,
      ].map((c) => [c.courseId, c]),
    );

    const recentCourses: RecentCourse[] = [...latestByCourse.entries()]
      .sort(([, a], [, b]) => {
        if (a.semester.academicYear.year !== b.semester.academicYear.year) {
          return b.semester.academicYear.year - a.semester.academicYear.year;
        }
        return (
          SEMESTER_TERM_RANK[b.semester.term] -
          SEMESTER_TERM_RANK[a.semester.term]
        );
      })
      .slice(0, RECENT_COURSES_LIMIT)
      .map(([courseId, attempt]) => {
        const info = courseInfoById.get(courseId);
        return {
          courseId,
          code: info?.code ?? '',
          name: info?.name ?? '',
          credits: attempt.credits,
          grade: attempt.grade,
          academicYear: attempt.semester.academicYear.year,
          semesterTerm: attempt.semester.term,
        };
      });

    const curriculumProgressPercent = creditProgressPercent(
      creditCheck.creditsPassed,
      creditCheck.totalCreditsRequired,
    );

    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentProfileId },
      select: {
        admissionYear: true,
        curriculum: { select: { durationYears: true } },
      },
    });
    const currentAcademicYear = await this.resolveCurrentAcademicYear();
    const expectedCredits = expectedCreditsByNow(
      creditCheck.totalCreditsRequired,
      profile.curriculum.durationYears,
      currentAcademicYear,
      profile.admissionYear,
    );

    return {
      studentProfileId: creditCheck.studentProfileId,
      gpa: gpaResult.gpa,
      gpaTrend: buildGpaTrend(gpaResult.bySemester),
      creditsEarned: creditCheck.creditsPassed,
      creditsRemaining: creditCheck.creditsRemaining,
      totalCreditsRequired: creditCheck.totalCreditsRequired,
      curriculumProgressPercent,
      yearLevel: resolveYearLevel(currentAcademicYear, profile.admissionYear),
      expectedCredits,
      onTrackStatus: resolveOnTrackStatus(
        creditCheck.creditsPassed,
        creditCheck.totalCreditsRequired,
        expectedCredits,
      ),
      graduationReadiness: creditCheck.graduationReadiness,
      radar: ploReport.radar,
      strengths: ploReport.strengths,
      areasForImprovement: ploReport.areasForImprovement,
      recentCourses,
      missingRequiredCourses: learningPath.missingRequiredCourses,
      incompleteElectiveCategories: learningPath.incompleteElectiveCategories,
      pendingAssessmentCount:
        await this.courseAssessmentService.countPendingForStudent(
          studentProfileId,
        ),
      aiSummary: null,
    };
  }

  // Self-scoped — no guard needed beyond @Roles('INSTRUCTOR'), same shape
  // as GET /courses/my-courses.
  async getInstructorDashboard(
    user: RequestUser,
  ): Promise<InstructorDashboardReport> {
    const courses = await this.courseService.findMyCourses(user.userId);

    const summaries = await Promise.all(
      courses.map(async (course) => {
        const cloReport = await this.cloAchievementService.calculateForCourse(
          course.id,
        );
        const ploReport = await this.ploAchievementService.calculateForCourse(
          course.id,
        );
        const courseAssessment =
          await this.courseAssessmentService.getAggregateForCourse(course.id);
        const records =
          await this.studentCourseRecordService.findActiveRecordsForCourse(
            course.id,
          );
        const latestAttempts =
          this.studentCourseRecordService.dedupeLatestPerStudent(records);
        const gradeDistribution =
          this.studentCourseRecordService.tallyGradeDistribution(
            latestAttempts,
          );

        const atRiskAttempts =
          this.studentCourseRecordService.selectAtRiskAttempts(latestAttempts);

        const semesterTrend =
          this.studentCourseRecordService.summarizeBySemester(records);

        return {
          atRiskAttempts,
          summary: {
            courseId: course.id,
            code: course.code,
            name: course.name,
            studentCount: cloReport.totalStudents,
            achievementPercent: cloReport.achievementPercent,
            achievementThreshold: cloReport.achievementThreshold,
            gradeDistribution,
            clos: cloReport.clos,
            plos: ploReport.plos,
            courseAssessment,
            semesterTrend,
          },
        };
      }),
    );

    // One name lookup across every course, not one per course.
    const atRiskProfileIds = new Set(
      summaries.flatMap(({ atRiskAttempts }) =>
        atRiskAttempts.map((attempt) => attempt.studentProfileId),
      ),
    );
    const profiles =
      atRiskProfileIds.size > 0
        ? await this.prisma.studentProfile.findMany({
            where: { id: { in: [...atRiskProfileIds] } },
            select: {
              id: true,
              studentCode: true,
              user: { select: { fullName: true } },
            },
          })
        : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const courseSummaries: InstructorCourseSummary[] = summaries.map(
      ({ atRiskAttempts, summary }) => ({
        ...summary,
        atRiskStudents: atRiskAttempts.map((attempt) => {
          const profile = profileById.get(attempt.studentProfileId)!;
          return {
            studentProfileId: attempt.studentProfileId,
            studentCode: profile.studentCode,
            fullName: profile.user.fullName,
            grade: attempt.grade,
            riskLevel: riskLevel(attempt.grade),
            academicYear: attempt.semester.academicYear.year,
            semesterTerm: attempt.semester.term,
          };
        }),
      }),
    );

    return { courses: courseSummaries };
  }

  // Self-scoped, like getInstructorDashboard — but a separate endpoint
  // rather than an added field on InstructorDashboardReport, since this
  // view needs none of that report's CLO/PLO/Course-Assessment
  // computation and a shared shape would force every "My Courses" fetch
  // to pay for both.
  async getInstructorCourseTimeline(
    user: RequestUser,
  ): Promise<InstructorCourseTimelineReport> {
    const courses = await this.courseService.findMyCourses(user.userId);
    const records =
      await this.studentCourseRecordService.findActiveRecordsForCoursesWithStudentProfile(
        courses.map((course) => course.id),
      );
    return {
      years: this.studentCourseRecordService.groupCoursesByYearAndSemester(records),
    };
  }

  // Flat list across ALL of the instructor's own courses at once, unlike
  // getStudentRosterForCourse (single-course only) — for filtering by
  // course/risk without leaving the page. Self-scoped like
  // getInstructorDashboard (no client-supplied :courseId to validate
  // against another user — courseId here is only an optional narrowing
  // filter, checked against the instructor's own course set below, never
  // trusted directly), so @Roles('INSTRUCTOR') alone is sufficient, no
  // extra guard needed.
  async getInstructorStudents(
    user: RequestUser,
    courseId?: string,
    riskLevelFilter?: RiskLevel,
  ): Promise<InstructorStudentsReport> {
    const courses = await this.courseService.findMyCourses(user.userId);
    const courseById = new Map(courses.map((c) => [c.id, c]));

    // An unrecognized/foreign courseId silently yields zero rows rather
    // than a 403 — this is a self-service list filter, not record access.
    const courseIds = courseId
      ? courseById.has(courseId)
        ? [courseId]
        : []
      : courses.map((c) => c.id);

    const records =
      await this.studentCourseRecordService.findActiveRecordsForCourses(
        courseIds,
      );

    // Deduped PER COURSE, not globally per student — a student taking two
    // of this instructor's courses needs two rows, one per course context.
    const recordsByCourse = groupBy(records, (r) => r.courseId);
    const latestPerCoursePerStudent = [...recordsByCourse.entries()].flatMap(
      ([cId, courseRecords]) => {
        const latest =
          this.studentCourseRecordService.dedupeLatestPerStudent(
            courseRecords,
          );
        return [...latest.values()].map((attempt) => ({
          courseId: cId,
          attempt,
        }));
      },
    );

    const studentProfileIds = new Set(
      latestPerCoursePerStudent.map(({ attempt }) => attempt.studentProfileId),
    );
    const profiles =
      studentProfileIds.size > 0
        ? await this.prisma.studentProfile.findMany({
            where: { id: { in: [...studentProfileIds] } },
            select: {
              id: true,
              studentCode: true,
              user: { select: { fullName: true } },
            },
          })
        : [];
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    const students: InstructorStudentEntry[] = latestPerCoursePerStudent
      .map(({ courseId: cId, attempt }) => {
        const profile = profileById.get(attempt.studentProfileId)!;
        const course = courseById.get(cId)!;
        return {
          studentProfileId: attempt.studentProfileId,
          studentCode: profile.studentCode,
          fullName: profile.user.fullName,
          courseId: cId,
          courseCode: course.code,
          courseName: course.name,
          grade: attempt.grade,
          riskLevel: riskLevel(attempt.grade),
        };
      })
      .filter((s) => !riskLevelFilter || s.riskLevel === riskLevelFilter)
      .sort((a, b) => a.studentCode.localeCompare(b.studentCode));

    return {
      courses: courses.map((c) => ({
        courseId: c.id,
        code: c.code,
        name: c.name,
      })),
      students,
    };
  }

  // Students grouped by year level (1-4), scoped to only students who
  // have taken a course with THIS instructor — never program/curriculum
  // -wide. Constant 4 queries regardless of course/student count: findMyCourses,
  // findActiveRecordsForCourses, studentProfile.findMany,
  // academicYear.findAll — everything else is a single in-memory pass,
  // mirroring PloAchievementService.calculateForCurriculum's
  // cohortComparison bucketing rather than calculateForCohort's known
  // N-query-per-cohort pattern.
  async getInstructorYearLevels(
    user: RequestUser,
  ): Promise<InstructorYearLevelsReport> {
    const courses = await this.courseService.findMyCourses(user.userId);
    const courseIds = courses.map((c) => c.id);

    const records =
      await this.studentCourseRecordService.findActiveRecordsForCourses(
        courseIds,
      );
    const latestByStudent =
      this.studentCourseRecordService.dedupeLatestPerStudent(records);

    const profiles =
      latestByStudent.size > 0
        ? await this.prisma.studentProfile.findMany({
            where: { id: { in: [...latestByStudent.keys()] } },
            select: {
              id: true,
              studentCode: true,
              admissionYear: true,
              curriculumId: true,
              user: { select: { fullName: true } },
            },
          })
        : [];

    const currentAcademicYear = await this.resolveCurrentAcademicYear();
    const onTrackByStudent = await this.computeOnTrackStatuses(
      profiles,
      currentAcademicYear,
    );
    return {
      currentAcademicYear,
      buckets: this.bucketByYearLevel(
        profiles.map((profile) => ({
          studentProfileId: profile.id,
          studentCode: profile.studentCode,
          fullName: profile.user.fullName,
          admissionYear: profile.admissionYear,
          onTrackStatus: onTrackByStudent.get(profile.id) ?? null,
        })),
        currentAcademicYear,
      ),
    };
  }

  // Same buckets as the instructor view, but the population is every
  // active student in the Programs this STAFF covers — the same
  // getCoveredProgramIds scoping as the rest of /dashboard/staff, so this
  // page and the directory can never disagree about who is in scope.
  // Suspended students are left out, matching getStaffOverview's counts.
  async getStaffYearLevels(user: RequestUser): Promise<StaffYearLevelsReport> {
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    const currentAcademicYear = await this.resolveCurrentAcademicYear();
    if (programIds.length === 0) {
      return {
        currentAcademicYear,
        buckets: this.bucketByYearLevel([], currentAcademicYear),
      };
    }

    const profiles = await this.prisma.studentProfile.findMany({
      where: { programId: { in: programIds }, isActive: true },
      select: {
        id: true,
        studentCode: true,
        admissionYear: true,
        curriculumId: true,
        user: { select: { fullName: true } },
      },
    });
    // One records fetch shared by the risk and on-track passes.
    const records =
      await this.studentCourseRecordService.findActiveRecordsForStudents(
        profiles.map((profile) => profile.id),
      );
    const riskByStudent = await this.computeStudentRisk(
      profiles.map((profile) => profile.id),
      records,
    );
    const onTrackByStudent = await this.computeOnTrackStatuses(
      profiles,
      currentAcademicYear,
      records,
    );

    return {
      currentAcademicYear,
      buckets: this.bucketByYearLevel(
        profiles.map((profile) => {
          const risk = riskByStudent.get(profile.id)!;
          return {
            studentProfileId: profile.id,
            studentCode: profile.studentCode,
            fullName: profile.user.fullName,
            admissionYear: profile.admissionYear,
            onTrackStatus: onTrackByStudent.get(profile.id) ?? null,
            gpa: risk.gpa,
            riskLevel: risk.riskLevel,
            lowGradeCount: risk.lowGradeCount,
          };
        }),
        currentAcademicYear,
      ),
    };
  }

  // On-track status for a whole population in bulk: one curriculum-tree
  // fetch for every distinct curriculum (plus one records fetch unless the
  // caller already has them), then the same pure computeCreditCheck /
  // expectedCreditsByNow / resolveOnTrackStatus the student dashboard uses
  // (CONVENTIONS.md §6) — no per-student query.
  private async computeOnTrackStatuses(
    profiles: {
      id: string;
      curriculumId: string;
      admissionYear: number;
    }[],
    currentAcademicYear: number,
    preloadedRecords?: LatestCourseAttempt[],
  ): Promise<Map<string, OnTrackStatus | null>> {
    const result = new Map<string, OnTrackStatus | null>();
    if (profiles.length === 0) return result;

    const [trees, records] = await Promise.all([
      this.creditCheckerService.loadCurriculumTrees([
        ...new Set(profiles.map((profile) => profile.curriculumId)),
      ]),
      preloadedRecords ??
        this.studentCourseRecordService.findActiveRecordsForStudents(
          profiles.map((profile) => profile.id),
        ),
    ]);
    const recordsByStudent = groupBy(records, (r) => r.studentProfileId);

    for (const profile of profiles) {
      const tree = trees.get(profile.curriculumId);
      if (!tree) {
        result.set(profile.id, null);
        continue;
      }
      const { creditsPassed } = this.creditCheckerService.computeCreditCheck(
        profile,
        tree,
        this.studentCourseRecordService.dedupeLatestPerCourse(
          recordsByStudent.get(profile.id) ?? [],
        ),
      );
      result.set(
        profile.id,
        resolveOnTrackStatus(
          creditsPassed,
          tree.totalCredits,
          expectedCreditsByNow(
            tree.totalCredits,
            tree.durationYears,
            currentAcademicYear,
            profile.admissionYear,
          ),
        ),
      );
    }
    return result;
  }

  // No stored "current academic year" in the schema (AcademicYear.isActive
  // is a soft-delete flag), so it's MAX(year) among active rows.
  private async resolveCurrentAcademicYear(): Promise<number> {
    const academicYears = await this.academicYearService.findAll();
    return academicYears.length > 0
      ? Math.max(...academicYears.map((y) => y.year))
      : new Date().getFullYear();
  }

  private bucketByYearLevel<T extends YearLevelStudent>(
    students: T[],
    currentAcademicYear: number,
  ): YearLevelBucket<T>[] {
    const buckets = new Map<number, T[]>();
    for (const student of students) {
      const yearLevel = resolveYearLevel(
        currentAcademicYear,
        student.admissionYear,
      );
      const bucket = buckets.get(yearLevel) ?? [];
      bucket.push(student);
      buckets.set(yearLevel, bucket);
    }

    return [1, 2, 3, 4].map((yearLevel) => ({
      yearLevel,
      label: YEAR_LEVEL_LABELS[yearLevel],
      students: (buckets.get(yearLevel) ?? []).sort((a, b) =>
        a.studentCode.localeCompare(b.studentCode),
      ),
    }));
  }

  async getCurriculumDashboard(
    curriculumId: string,
  ): Promise<CurriculumDashboardReport> {
    const report = await this.ploAchievementService.calculateForCurriculum(
      curriculumId,
    );
    return { ...report, aiCurriculumSummary: null };
  }

  // Scoped curriculum overview for ADMIN — the 3-tier
  // resolveDataState() 3-tier classification, narrowed to the Programs the
  // requester's own UserScope covers, and without the GPA/radar fields
  // (this overview only needs counts). Fixed query count regardless of how
  // many programs/curricula/users are in scope: 1 (programs) + 3 in one
  // Promise.all (role counts / student count / curricula) + 3 in a second
  // Promise.all (per-curriculum count groupBys) = 7 total, mirroring
  // getSystemCurriculumOverview's "batch once, never loop per curriculum"
  // discipline.
  async getAdminScopeOverview(user: RequestUser): Promise<AdminScopeOverviewReport> {
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    if (programIds.length === 0) {
      return {
        scope: { facultyCount: 0, departmentCount: 0, programCount: 0, programs: [] },
        userCounts: { staff: 0, instructor: 0, admin: 0, student: 0 },
        curricula: {
          totalCount: 0,
          hasStudentsCount: 0,
          structureOnlyCount: 0,
          emptyCount: 0,
          entries: [],
        },
      };
    }

    const programs = await this.prisma.program.findMany({
      where: { id: { in: programIds }, isActive: true },
      include: { department: { include: { faculty: true } } },
    });

    const facultyIds = new Set(programs.map((p) => p.department.facultyId));
    const departmentIds = new Set(programs.map((p) => p.departmentId));

    // Students hold no UserScope row (their scope is implicit via
    // StudentProfile.programId), so STAFF/INSTRUCTOR/ADMIN are counted via
    // the requester's own UserScope ancestry while STUDENT is counted via
    // programIds — two structurally different queries, not one.
    const userScopeFilter =
      await this.scopeResolverService.buildUserScopeOrFilter(user.userId);
    const [roleCounts, studentCount, curricula] = await Promise.all([
      this.prisma.userRole.groupBy({
        by: ['role'],
        where: {
          role: { in: ['STAFF', 'INSTRUCTOR', 'ADMIN'] },
          user: { isActive: true, scopes: { some: { OR: userScopeFilter } } },
        },
        _count: { _all: true },
      }),
      this.prisma.studentProfile.count({
        where: { programId: { in: programIds }, isActive: true },
      }),
      this.prisma.curriculum.findMany({
        where: { programId: { in: programIds }, isActive: true },
        include: {
        program: {
          select: {
            code: true,
            name: true,
            department: {
              select: { name: true, faculty: { select: { name: true } } },
            },
          },
        },
      },
        orderBy: [{ program: { code: 'asc' } }, { version: 'asc' }],
      }),
    ]);

    const roleCountByRole = new Map(
      roleCounts.map((entry) => [entry.role, entry._count._all]),
    );

    const curriculumIds = curricula.map((curriculum) => curriculum.id);
    const [studentCounts, courseCounts, ploCounts] = await Promise.all([
      this.prisma.studentProfile.groupBy({
        by: ['curriculumId'],
        where: { curriculumId: { in: curriculumIds }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.course.groupBy({
        by: ['curriculumId'],
        where: { curriculumId: { in: curriculumIds }, isActive: true },
        _count: { _all: true },
      }),
      this.prisma.plo.groupBy({
        by: ['curriculumId'],
        where: { curriculumId: { in: curriculumIds }, isActive: true },
        _count: { _all: true },
      }),
    ]);

    const studentCountByCurriculum = new Map(
      studentCounts.map((entry) => [entry.curriculumId, entry._count._all]),
    );
    const courseCountByCurriculum = new Map(
      courseCounts.map((entry) => [entry.curriculumId, entry._count._all]),
    );
    const ploCountByCurriculum = new Map(
      ploCounts.map((entry) => [entry.curriculumId, entry._count._all]),
    );

    let hasStudentsCount = 0;
    let structureOnlyCount = 0;
    let emptyCount = 0;
    const curriculumEntries: AdminScopeCurriculumEntry[] = curricula.map(
      (curriculum) => {
        const curriculumStudentCount =
          studentCountByCurriculum.get(curriculum.id) ?? 0;
        const courseCount = courseCountByCurriculum.get(curriculum.id) ?? 0;
        const ploCount = ploCountByCurriculum.get(curriculum.id) ?? 0;
        const dataState = resolveDataState(
          curriculumStudentCount,
          courseCount,
          ploCount,
        );
        if (dataState === 'HAS_STUDENTS') hasStudentsCount += 1;
        else if (dataState === 'STRUCTURE_ONLY') structureOnlyCount += 1;
        else emptyCount += 1;

        return {
          curriculumId: curriculum.id,
          version: curriculum.version,
          effectiveYear: curriculum.effectiveYear,
          programCode: curriculum.program.code,
          programName: curriculum.program.name,
          dataState,
          studentCount: curriculumStudentCount,
          courseCount,
          ploCount,
        };
      },
    );

    return {
      scope: {
        facultyCount: facultyIds.size,
        departmentCount: departmentIds.size,
        programCount: programs.length,
        programs: programs.map((program) => ({
          programId: program.id,
          code: program.code,
          name: program.name,
          departmentName: program.department.name,
          facultyName: program.department.faculty.name,
        })),
      },
      userCounts: {
        staff: roleCountByRole.get('STAFF') ?? 0,
        instructor: roleCountByRole.get('INSTRUCTOR') ?? 0,
        admin: roleCountByRole.get('ADMIN') ?? 0,
        student: studentCount,
      },
      curricula: {
        totalCount: curricula.length,
        hasStudentsCount,
        structureOnlyCount,
        emptyCount,
        entries: curriculumEntries,
      },
    };
  }

  // A CLO inherits its course's single achievementPercent (Phase 8
  // limitation), so this is really "which courses sit below the bar",
  // reported at CLO granularity. Courses nobody has taken are skipped
  // entirely rather than counted as 0% failures, and stay absent from
  // cloBelowThreshold so the PLO rollup can tell "not measured" from
  // "measured and failing".
  private collectProblematicClos(
    curricula: CurriculumWithProgram[],
    coursesByCurriculum: Map<string, Course[]>,
    closByCourse: Map<string, Clo[]>,
    achievementByCourse: Map<string, { totalStudents: number; achievementPercent: number }>,
  ): {
    problematicClos: ProblematicCloEntry[];
    cloBelowThreshold: Map<string, boolean>;
  } {
    const problematicClos: ProblematicCloEntry[] = [];
    const cloBelowThreshold = new Map<string, boolean>();

    for (const curriculum of curricula) {
      for (const course of coursesByCurriculum.get(curriculum.id) ?? []) {
        const achievement = achievementByCourse.get(course.id);
        if (!achievement || achievement.totalStudents === 0) continue;

        for (const clo of closByCourse.get(course.id) ?? []) {
          const threshold =
            clo.achievementThreshold ?? curriculum.defaultAchievementThreshold;
          const isBelow = achievement.achievementPercent < threshold;
          cloBelowThreshold.set(clo.id, isBelow);
          if (!isBelow) continue;

          problematicClos.push({
            cloId: clo.id,
            code: clo.code,
            description: clo.description,
            courseId: course.id,
            courseCode: course.code,
            courseName: course.name,
            curriculumId: curriculum.id,
            curriculumVersion: curriculum.version,
            programCode: curriculum.program.code,
            achievementPercent: achievement.achievementPercent,
            threshold,
          });
        }
      }
    }

    problematicClos.sort((a, b) => a.achievementPercent - b.achievementPercent);
    return { problematicClos, cloBelowThreshold };
  }

  // Flagged when at least half of a PLO's measurable CLOs are below
  // their threshold. The counts travel with the verdict so the UI can
  // show the evidence instead of an unexplained red badge.
  private selectProblematicPlos(
    curriculum: CurriculumWithProgram,
    plos: PloWithMappings[],
    radar: RadarPoint[],
    cloBelowThreshold: Map<string, boolean>,
  ): ProblematicPloEntry[] {
    const flagged: ProblematicPloEntry[] = [];

    for (const plo of plos) {
      let below = 0;
      let measured = 0;
      for (const mapping of plo.cloMappings) {
        const isBelow = cloBelowThreshold.get(mapping.clo.id);
        if (isBelow === undefined) continue; // course never taken
        measured += 1;
        if (isBelow) below += 1;
      }
      if (measured === 0 || below * 2 < measured) continue;

      flagged.push({
        ploId: plo.id,
        code: plo.code,
        name: plo.name,
        curriculumId: curriculum.id,
        curriculumVersion: curriculum.version,
        programCode: curriculum.program.code,
        closBelowThreshold: below,
        totalMeasuredClos: measured,
        averageValue: radar.find((r) => r.ploId === plo.id)?.value ?? null,
      });
    }
    return flagged;
  }

  // One curriculum's student-derived numbers, computed entirely from
  // records already in memory. Mirrors what calculateForCurriculum does
  // for a single curriculum, minus the cohort split and course analytics
  // this overview doesn't show.
  private summarizeCurriculum({
    curriculum,
    students,
    courses,
    plos,
    tree,
    recordsByStudent,
    closByCourse,
  }: {
    curriculum: CurriculumWithProgram;
    students: StudentProfile[];
    courses: Course[];
    plos: PloWithMappings[];
    tree: CreditCheckCurriculumTree | undefined;
    recordsByStudent: Map<string, LatestCourseAttempt[]>;
    closByCourse: Map<string, Clo[]>;
  }): SystemCurriculumEntry {
    const gpas: number[] = [];
    let studentsAtRiskCount = 0;
    let graduationReadyCount = 0;
    const ploSums = new Map<string, { sum: number; count: number }>();

    for (const student of students) {
      const attempts = this.studentCourseRecordService.dedupeLatestPerCourse(
        recordsByStudent.get(student.id) ?? [],
      );

      const { gpa } =
        this.studentCourseRecordService.calculateGpaFromAttempts(attempts);
      if (gpa !== null) {
        gpas.push(gpa);
        if (gpaRiskLevel(gpa) !== 'NORMAL') studentsAtRiskCount += 1;
      }

      // A curriculum with no requirement tree can't be graduated from,
      // so readiness stays 0 rather than defaulting to "ready".
      if (tree) {
        const { graduationReadiness } =
          this.creditCheckerService.computeCreditCheck(student, tree, attempts);
        if (graduationReadiness.isReady) graduationReadyCount += 1;
      }

      this.ploAchievementService.accumulateRadar(
        ploSums,
        this.ploAchievementService.computeStudentPloScores(plos, attempts),
      );
    }

    const radar = this.ploAchievementService.buildRadarFromSums(plos, ploSums);
    const measured = radar.filter(
      (point): point is RadarPoint & { value: number } => point.value !== null,
    );

    return {
      curriculumId: curriculum.id,
      version: curriculum.version,
      effectiveYear: curriculum.effectiveYear,
      programCode: curriculum.program.code,
      programName: curriculum.program.name,
      departmentName: curriculum.program.department.name,
      facultyName: curriculum.program.department.faculty.name,
      dataState: resolveDataState(students.length, courses.length, plos.length),
      studentCount: students.length,
      courseCount: courses.length,
      cloCount: courses.reduce(
        (sum, course) => sum + (closByCourse.get(course.id)?.length ?? 0),
        0,
      ),
      ploCount: plos.length,
      averageGpa: gpas.length > 0 ? average(gpas) : null,
      studentsAtRiskCount,
      graduationReadyCount,
      averagePloValue:
        measured.length > 0
          ? average(measured.map((point) => point.value))
          : null,
      radar,
    };
  }

  // Lightweight per-program/curriculum overview for STAFF, scoped via
  // getCoveredProgramIds — deliberately does not go through
  // PloAchievementService.calculateForCurriculum (that's the heavier
  // PLO radar/cohort/at-risk report behind /dashboard/curriculum/:id,
  // ADMIN/SUPER_ADMIN only).
  //
  // GPA used to cost one query per student (a loop per curriculum, each
  // calling getLatestAttemptsPerCourse). Scope here can span a whole
  // faculty, so that grew without bound. Students and their records are
  // now each fetched once for the entire scope and grouped in memory —
  // the query count no longer depends on how many students there are.
  async getStaffOverview(user: RequestUser): Promise<StaffOverviewReport> {
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    if (programIds.length === 0) {
      return {
        programs: [],
        atRiskStudents: [],
        atRiskSummary: { critical: 0, watch: 0 },
      };
    }

    const programs = await this.prisma.program.findMany({
      where: { id: { in: programIds }, isActive: true },
      include: { department: { include: { faculty: true } } },
    });

    const curricula = await this.prisma.curriculum.findMany({
      where: { programId: { in: programIds }, isActive: true },
    });

    const curriculaByProgram = new Map<string, typeof curricula>();
    for (const curriculum of curricula) {
      const list = curriculaByProgram.get(curriculum.programId) ?? [];
      list.push(curriculum);
      curriculaByProgram.set(curriculum.programId, list);
    }

    const { gpaByCurriculum, atRiskStudents, atRiskSummary } =
      await this.summarizeStudentsInScope(programs, curricula);

    const overviewPrograms = await Promise.all(
      programs.map(async (program) => ({
        programId: program.id,
        programName: program.name,
        programCode: program.code,
        departmentName: program.department.name,
        facultyName: program.department.faculty.name,
        curricula: await Promise.all(
          (curriculaByProgram.get(program.id) ?? []).map((curriculum) =>
            this.getStaffOverviewCurriculum(
              curriculum.id,
              curriculum.version,
              curriculum.effectiveYear,
              gpaByCurriculum.get(curriculum.id),
            ),
          ),
        ),
      })),
    );

    return {
      programs: overviewPrograms,
      atRiskStudents: atRiskStudents.slice(0, STAFF_AT_RISK_LIMIT),
      atRiskSummary,
    };
  }

  // Two queries for the whole scope — every in-scope student, then every
  // one of their active records — and both the GPA average and the
  // at-risk roll-up come off that same pass.
  //
  // Retake collapsing stays in dedupeLatestPerCourse, the GPA math in
  // calculateGpaFromAttempts, and the at-risk selection in
  // selectAtRiskAttempts. None is reimplemented here (CONVENTIONS.md §6),
  // which is what keeps a staff CRITICAL and an instructor CRITICAL the
  // same claim about the same student.
  private async summarizeStudentsInScope(
    programs: { id: string; code: string }[],
    curricula: { id: string; version: string }[],
  ): Promise<{
    gpaByCurriculum: Map<
      string,
      { studentCount: number; averageGpa: number | null }
    >;
    atRiskStudents: StaffAtRiskStudent[];
    atRiskSummary: { critical: number; watch: number };
  }> {
    const students = await this.prisma.studentProfile.findMany({
      where: {
        curriculumId: { in: curricula.map((curriculum) => curriculum.id) },
        isActive: true,
      },
      select: {
        id: true,
        curriculumId: true,
        programId: true,
        studentCode: true,
        user: { select: { fullName: true } },
      },
    });

    const riskByStudent = await this.computeStudentRisk(
      students.map((student) => student.id),
    );

    const programCodeById = new Map(programs.map((p) => [p.id, p.code]));
    const versionByCurriculumId = new Map(
      curricula.map((curriculum) => [curriculum.id, curriculum.version]),
    );

    const gpasByCurriculum = new Map<string, (number | null)[]>();
    const atRiskStudents: StaffAtRiskStudent[] = [];
    const atRiskSummary = { critical: 0, watch: 0 };

    for (const student of students) {
      const risk = riskByStudent.get(student.id)!;

      const gpas = gpasByCurriculum.get(student.curriculumId) ?? [];
      gpas.push(risk.gpa);
      gpasByCurriculum.set(student.curriculumId, gpas);

      if (risk.riskLevel === 'NORMAL') continue;

      if (risk.riskLevel === 'CRITICAL') atRiskSummary.critical += 1;
      else if (risk.riskLevel === 'WATCH') atRiskSummary.watch += 1;

      atRiskStudents.push({
        studentProfileId: student.id,
        studentCode: student.studentCode,
        fullName: student.user.fullName,
        riskLevel: risk.riskLevel,
        lowGradeCount: risk.lowGradeCount,
        gpa: risk.gpa,
        programCode: programCodeById.get(student.programId) ?? '',
        curriculumVersion:
          versionByCurriculumId.get(student.curriculumId) ?? '',
      });
    }

    // CRITICAL above WATCH, then lowest GPA — the cap below has to keep
    // the students worth looking at first. Everyone here has a GPA.
    atRiskStudents.sort(
      (a, b) =>
        Number(b.riskLevel === 'CRITICAL') - Number(a.riskLevel === 'CRITICAL') ||
        (a.gpa ?? 0) - (b.gpa ?? 0),
    );

    const gpaByCurriculum = new Map<
      string,
      { studentCount: number; averageGpa: number | null }
    >();
    for (const [curriculumId, gpas] of gpasByCurriculum) {
      const gradedGpas = gpas.filter((gpa): gpa is number => gpa !== null);
      gpaByCurriculum.set(curriculumId, {
        studentCount: gpas.length,
        averageGpa:
          gradedGpas.length > 0
            ? gradedGpas.reduce((sum, gpa) => sum + gpa, 0) / gradedGpas.length
            : null,
      });
    }

    return { gpaByCurriculum, atRiskStudents, atRiskSummary };
  }

  // One query for a whole cohort's records, then per student: collapse
  // retakes and average. Every step is an existing StudentCourseRecordService
  // method — this only groups their inputs (CONVENTIONS.md §6).
  //
  // The band comes from the cumulative GPA alone (gpaRiskLevel). A student
  // with no GPA reads NORMAL here with gpa null, which the Staff pages show
  // as "no data". lowGradeCount (D+/D/F/U) is context, never part of the band.
  private async computeStudentRisk(
    studentProfileIds: string[],
    preloadedRecords?: LatestCourseAttempt[],
  ): Promise<
    Map<
      string,
      {
        gpa: number | null;
        riskLevel: RiskLevel;
        lowGradeCount: number;
      }
    >
  > {
    const records =
      preloadedRecords ??
      (await this.studentCourseRecordService.findActiveRecordsForStudents(
        studentProfileIds,
      ));
    const recordsByStudent = new Map<string, typeof records>();
    for (const record of records) {
      const list = recordsByStudent.get(record.studentProfileId) ?? [];
      list.push(record);
      recordsByStudent.set(record.studentProfileId, list);
    }

    const riskByStudent = new Map<
      string,
      {
        gpa: number | null;
        riskLevel: RiskLevel;
        lowGradeCount: number;
      }
    >();
    for (const studentProfileId of studentProfileIds) {
      const latestByCourse =
        this.studentCourseRecordService.dedupeLatestPerCourse(
          recordsByStudent.get(studentProfileId) ?? [],
        );
      const { gpa } =
        this.studentCourseRecordService.calculateGpaFromAttempts(
          latestByCourse,
        );
      riskByStudent.set(studentProfileId, {
        gpa,
        riskLevel: gpaRiskLevel(gpa) ?? 'NORMAL',
        lowGradeCount: [...latestByCourse.values()].filter((attempt) =>
          CRITICAL_GRADES.has(attempt.grade),
        ).length,
      });
    }
    return riskByStudent;
  }

  // The risk-annotated student list behind the staff directory. Scoped by
  // programId to match GET /student-profiles, which this replaces on that
  // page, and deliberately NOT filtered to isActive — the directory shows
  // suspended students with a status badge, unlike the dashboard's
  // enrolment aggregates.
  async getStaffStudentRisk(
    user: RequestUser,
  ): Promise<StaffStudentRiskEntry[]> {
    const programIds = await this.scopeResolverService.getCoveredProgramIds(
      user.userId,
    );
    if (programIds.length === 0) return [];

    const students = await this.prisma.studentProfile.findMany({
      where: { programId: { in: programIds } },
      select: {
        id: true,
        studentCode: true,
        programId: true,
        curriculumId: true,
        admissionYear: true,
        isActive: true,
        user: { select: { fullName: true } },
      },
    });

    const riskByStudent = await this.computeStudentRisk(
      students.map((student) => student.id),
    );

    return students.map((student) => {
      const risk = riskByStudent.get(student.id)!;
      return {
        studentProfileId: student.id,
        studentCode: student.studentCode,
        fullName: student.user.fullName,
        programId: student.programId,
        curriculumId: student.curriculumId,
        admissionYear: student.admissionYear,
        isActive: student.isActive,
        riskLevel: risk.riskLevel,
        gpa: risk.gpa,
        lowGradeCount: risk.lowGradeCount,
      };
    });
  }

  private async getStaffOverviewCurriculum(
    curriculumId: string,
    version: string,
    effectiveYear: number,
    // Absent when the curriculum enrolls nobody — no students means no
    // entry in the grouped map, not a zero-length one.
    gpaSummary: { studentCount: number; averageGpa: number | null } | undefined,
  ): Promise<StaffOverviewCurriculum> {
    const [totalCourses, coursesWithoutClo] = await Promise.all([
      this.prisma.course.count({ where: { curriculumId, isActive: true } }),
      this.prisma.course.count({
        where: {
          curriculumId,
          isActive: true,
          clos: { none: { isActive: true } },
        },
      }),
    ]);

    return {
      curriculumId,
      version,
      effectiveYear,
      studentCount: gpaSummary?.studentCount ?? 0,
      averageGpa: gpaSummary?.averageGpa ?? null,
      totalCourses,
      coursesWithoutClo,
    };
  }
}
