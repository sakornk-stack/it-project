import { sortByPloCode } from '../../../common/util/plo-order.util';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentProfile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import {
  gpaRiskLevel,
  gradeToScore,
} from '../../academic-record/student-course-record/grade-point.constant';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from '../../academic-record/student-course-record/student-course-record.service';
import { StudentProfileService } from '../../users/student-profile/student-profile.service';
import { CurriculumService } from '../../organization/curriculum/curriculum.service';
import {
  CreditCheckCurriculumTree,
  CreditCheckerService,
} from '../../academic-record/credit-checker/credit-checker.service';
import { CloAchievementService } from '../clo-achievement/clo-achievement.service';
import {
  CohortPloAchievementReport,
  CourseAnalyticsEntry,
  CoursePloAchievementReport,
  CoursePloEntry,
  CurriculumPloAchievementReport,
  LowestCloEntry,
  RadarPoint,
  StudentPloAchievementReport,
  StudentPloCloBreakdownEntry,
  StudentPloRadarPoint,
} from './plo-achievement-report.interface';

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const group = groups.get(key(item)) ?? [];
    group.push(item);
    groups.set(key(item), group);
  }
  return groups;
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created = factory();
  map.set(key, created);
  return created;
}

export type PloWithMappings = Prisma.PloGetPayload<{
  include: {
    cloMappings: {
      include: { clo: { select: { id: true; courseId: true } } };
    };
  };
}>;

// Richer variant used only by calculateForStudent, which (unlike the
// Cohort/Curriculum/Course paths) needs enough per-CLO detail to render a
// breakdown — the other call sites keep the lean PloWithMappings query.
type PloWithMappingsAndCloDetail = Prisma.PloGetPayload<{
  include: {
    cloMappings: {
      include: {
        clo: {
          select: {
            id: true;
            code: true;
            description: true;
            achievementThreshold: true;
            courseId: true;
            course: { select: { code: true; name: true } };
          };
        };
      };
    };
  };
}>;

const STRENGTH_COUNT = 2;

@Injectable()
export class PloAchievementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
    private readonly cloAchievementService: CloAchievementService,
    private readonly curriculumService: CurriculumService,
    private readonly creditCheckerService: CreditCheckerService,
  ) {}

  async calculateForStudent(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<StudentPloAchievementReport> {
    const profile = await this.resolveOwnProfileOrValidate(
      studentProfileId,
      user,
    );
    return this.calculateForProfile(profile);
  }

  // The report itself, for a profile whose access the caller has already
  // checked (calculateForStudent above; AdvisorService for an advisee), so
  // every reader gets the same numbers (CONVENTIONS §6).
  async calculateForProfile(
    profile: Pick<StudentProfile, 'id' | 'curriculumId'>,
  ): Promise<StudentPloAchievementReport> {
    const curriculum = await this.curriculumService.findActiveByIdOrThrow(
      profile.curriculumId,
    );

    const plos: PloWithMappingsAndCloDetail[] = sortByPloCode(await this.prisma.plo.findMany({
      where: { curriculumId: profile.curriculumId, isActive: true },
      include: {
        cloMappings: {
          where: { isActive: true },
          include: {
            clo: {
              select: {
                id: true,
                code: true,
                description: true,
                achievementThreshold: true,
                courseId: true,
                course: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    }));

    const latestAttemptsByCourse =
      await this.studentCourseRecordService.getLatestAttemptsPerCourse(
        profile.id,
      );

    const radar = this.computeStudentPloScoresWithBreakdown(
      plos,
      latestAttemptsByCourse,
      curriculum.defaultAchievementThreshold,
    );
    const { strengths, areasForImprovement } =
      this.rankStrengthsAndWeaknesses(radar);

    return {
      studentProfileId: profile.id,
      curriculumId: profile.curriculumId,
      radar,
      strengths,
      areasForImprovement,
    };
  }

  // Reuses Phase 8's CloAchievementService rather than duplicating its
  // course/curriculum/student-record queries (CONVENTIONS.md §6). Also
  // gets course-existence validation for free (calculateForCourse throws
  // NotFoundException if the course doesn't exist or is inactive).
  async calculateForCourse(courseId: string): Promise<CoursePloAchievementReport> {
    const cloReport = await this.cloAchievementService.calculateForCourse(courseId);

    const mappings = await this.prisma.cloPloMapping.findMany({
      where: {
        isActive: true,
        cloId: { in: cloReport.clos.map((clo) => clo.cloId) },
      },
      include: { plo: true },
    });

    const achievementByClo = new Map(
      cloReport.clos.map((clo) => [clo.cloId, clo]),
    );

    const entriesByPlo = new Map<string, CoursePloEntry>();
    const weightSumByPlo = new Map<string, number>();
    const weightedScoreSumByPlo = new Map<string, number>();

    for (const mapping of mappings) {
      const clo = achievementByClo.get(mapping.cloId);
      if (!clo) {
        continue; // defensive — shouldn't happen, cloId set comes from cloReport itself
      }

      let entry = entriesByPlo.get(mapping.ploId);
      if (!entry) {
        entry = {
          ploId: mapping.plo.id,
          code: mapping.plo.code,
          name: mapping.plo.name,
          achievementPercent: null,
          cloBreakdown: [],
        };
        entriesByPlo.set(mapping.ploId, entry);
        weightSumByPlo.set(mapping.ploId, 0);
        weightedScoreSumByPlo.set(mapping.ploId, 0);
      }

      entry.cloBreakdown.push({
        cloId: clo.cloId,
        code: clo.code,
        weight: mapping.weight,
      });
      // No data for the course (null) is excluded from the average, not
      // counted as 0 — it must not drag the PLO down.
      if (cloReport.achievementPercent === null) {
        continue;
      }
      weightSumByPlo.set(
        mapping.ploId,
        weightSumByPlo.get(mapping.ploId)! + mapping.weight,
      );
      weightedScoreSumByPlo.set(
        mapping.ploId,
        weightedScoreSumByPlo.get(mapping.ploId)! +
          cloReport.achievementPercent * mapping.weight,
      );
    }

    // Weighted average of Phase 8's per-CLO achievementPercent. Every CLO
    // of this course currently shares the same achievementPercent (Phase
    // 8 limitation, see TODO.md), so this collapses to that one value
    // regardless of weight today — the formula is still correct and
    // becomes meaningful once CLO-specific grades or cross-course PLO
    // aggregation exist. Don't "simplify" this away.
    const plos = sortByPloCode(Array.from(entriesByPlo.values())).map((entry) => ({
      ...entry,
      achievementPercent:
        weightSumByPlo.get(entry.ploId)! > 0
          ? weightedScoreSumByPlo.get(entry.ploId)! / weightSumByPlo.get(entry.ploId)!
          : null,
    }));

    return {
      courseId: cloReport.courseId,
      achievementPercent: cloReport.achievementPercent,
      plos,
    };
  }

  // Cohort = (curriculumId, admissionYear) — Plo is Curriculum-scoped, so
  // averaging across different curricula would average numbers that
  // don't refer to the same PLO set at all. No self-ownership here
  // (SUPER_ADMIN-only endpoint, no per-user resolution needed).
  //
  // curriculum.plos is fetched ONCE for the whole cohort, not per
  // student, and getLatestAttemptsPerCourse's result is reused for BOTH
  // GPA and PLO scoring per student (one query, two calculations) — see
  // TODO.md for the accepted N-query-per-cohort limitation this still has
  // (no bulk multi-student attempts query exists yet).
  async calculateForCohort(
    curriculumId: string,
    admissionYear: number,
  ): Promise<CohortPloAchievementReport> {
    await this.curriculumService.findActiveByIdOrThrow(curriculumId);

    const plos = sortByPloCode(await this.prisma.plo.findMany({
      where: { curriculumId, isActive: true },
      include: {
        cloMappings: {
          where: { isActive: true },
          include: { clo: { select: { id: true, courseId: true } } },
        },
      },
    }));

    const students = await this.prisma.studentProfile.findMany({
      where: { curriculumId, admissionYear, isActive: true },
    });

    const gpas: number[] = [];
    const ploSums = new Map<string, { sum: number; count: number }>();

    for (const student of students) {
      const attempts = await this.studentCourseRecordService.getLatestAttemptsPerCourse(
        student.id,
      );

      const { gpa } = this.studentCourseRecordService.calculateGpaFromAttempts(attempts);
      if (gpa !== null) {
        gpas.push(gpa);
      }

      const radar = this.computeStudentPloScores(plos, attempts);
      for (const point of radar) {
        if (point.value === null) {
          continue; // no data for this student/PLO — excluded, not zero
        }
        const entry = ploSums.get(point.ploId) ?? { sum: 0, count: 0 };
        entry.sum += point.value;
        entry.count += 1;
        ploSums.set(point.ploId, entry);
      }
    }

    const radar: RadarPoint[] = plos.map((plo) => {
      const entry = ploSums.get(plo.id);
      return {
        ploId: plo.id,
        code: plo.code,
        name: plo.name,
        value: entry ? entry.sum / entry.count : null,
      };
    });
    const { strengths, areasForImprovement } =
      this.rankStrengthsAndWeaknesses(radar);

    return {
      curriculumId,
      admissionYear,
      studentCount: students.length,
      averageGpa:
        gpas.length > 0 ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null,
      gpaSampleSize: gpas.length,
      radar,
      strengths,
      areasForImprovement,
    };
  }

  // Curriculum-wide analytics — deliberately does NOT call
  // calculateForCohort per distinct admissionYear (that would re-fetch
  // `plos` and re-validate the curriculum once per cohort, AND process
  // every student twice, since cohorts partition the full student set).
  // Instead: fetch plos/curriculum tree/students ONCE, then run a single
  // loop that accumulates into BOTH curriculum-wide and per-cohort
  // buckets simultaneously. calculateForCohort itself is untouched and
  // still serves its own single-cohort endpoint.
  async calculateForCurriculum(
    curriculumId: string,
  ): Promise<CurriculumPloAchievementReport> {
    await this.curriculumService.findActiveByIdOrThrow(curriculumId);

    const plos = sortByPloCode(await this.prisma.plo.findMany({
      where: { curriculumId, isActive: true },
      include: {
        cloMappings: {
          where: { isActive: true },
          include: { clo: { select: { id: true, courseId: true } } },
        },
      },
    }));
    const curriculumTree = await this.creditCheckerService.loadCurriculumTree(
      curriculumId,
    );
    const students = await this.prisma.studentProfile.findMany({
      where: { curriculumId, isActive: true },
    });

    // One query for every student's records, then the retake policy
    // applied per student in memory — replaces one query per student.
    // Same shape as DashboardService.computeStudentRisk.
    const studentRecords =
      await this.studentCourseRecordService.findActiveRecordsForStudents(
        students.map((student) => student.id),
      );
    const recordsByStudent = groupBy(
      studentRecords,
      (record) => record.studentProfileId,
    );

    const {
      gpas,
      studentsAtRiskCount,
      graduationReadyCount,
      ploSums,
      cohortGpas,
      cohortPloSums,
    } = this.accumulateStudentMetrics(
      students,
      recordsByStudent,
      plos,
      curriculumTree,
    );

    const radar = this.buildRadarFromSums(plos, ploSums);
    const { strengths, areasForImprovement } =
      this.rankStrengthsAndWeaknesses(radar);

    const cohortComparison = this.buildCohortComparison(
      curriculumId,
      students,
      plos,
      cohortGpas,
      cohortPloSums,
    );

    const { courseAnalytics, lowestClos } =
      await this.buildCourseAnalytics(curriculumId);

    const withData = radar.filter(
      (p): p is RadarPoint & { value: number } => p.value !== null,
    );
    const lowestPlo =
      withData.length > 0
        ? withData.reduce((min, p) => (p.value < min.value ? p : min), withData[0])
        : null;

    return {
      curriculumId,
      studentCount: students.length,
      averageGpa: gpas.length > 0 ? this.average(gpas) : null,
      gpaSampleSize: gpas.length,
      studentsAtRiskCount,
      graduationReadyCount,
      graduationReadyPercent:
        students.length > 0
          ? (graduationReadyCount / students.length) * 100
          : null,
      radar,
      strengths,
      areasForImprovement,
      lowestPlo,
      lowestClos,
      courseAnalytics,
      cohortComparison,
    };
  }

  // Accumulates curriculum-wide and per-cohort buckets in a single pass.
  // Iteration order over `students` is load-bearing: the PLO sums are
  // floating-point `+=`, so visiting students in a different order (or
  // folding with reduce) can shift the last bits of the reported averages.
  private accumulateStudentMetrics(
    students: StudentProfile[],
    recordsByStudent: Map<string, LatestCourseAttempt[]>,
    plos: PloWithMappings[],
    curriculumTree: CreditCheckCurriculumTree,
  ) {
    const gpas: number[] = [];
    let studentsAtRiskCount = 0;
    let graduationReadyCount = 0;
    const ploSums = new Map<string, { sum: number; count: number }>();
    const cohortGpas = new Map<number, number[]>();
    const cohortPloSums = new Map<
      number,
      Map<string, { sum: number; count: number }>
    >();

    for (const student of students) {
      const attempts = this.studentCourseRecordService.dedupeLatestPerCourse(
        recordsByStudent.get(student.id) ?? [],
      );

      const { gpa } =
        this.studentCourseRecordService.calculateGpaFromAttempts(attempts);
      if (gpa !== null) {
        gpas.push(gpa);
        if (gpaRiskLevel(gpa) !== 'NORMAL') {
          studentsAtRiskCount += 1;
        }
        this.pushInto(cohortGpas, student.admissionYear, gpa);
      }

      const { graduationReadiness } =
        this.creditCheckerService.computeCreditCheck(
          student,
          curriculumTree,
          attempts,
        );
      if (graduationReadiness.isReady) {
        graduationReadyCount += 1;
      }

      const radar = this.computeStudentPloScores(plos, attempts);
      this.accumulateRadar(ploSums, radar);
      this.accumulateRadar(
        getOrCreate(cohortPloSums, student.admissionYear, () => new Map()),
        radar,
      );
    }

    return {
      gpas,
      studentsAtRiskCount,
      graduationReadyCount,
      ploSums,
      cohortGpas,
      cohortPloSums,
    };
  }

  private buildCohortComparison(
    curriculumId: string,
    students: StudentProfile[],
    plos: PloWithMappings[],
    cohortGpas: Map<number, number[]>,
    cohortPloSums: Map<number, Map<string, { sum: number; count: number }>>,
  ): CohortPloAchievementReport[] {
    // Every admission year with a student, not just those with a GPA — a
    // cohort nobody has recorded grades for yet still shows (averageGpa: null).
    return Array.from(new Set(students.map((s) => s.admissionYear)))
      .sort((a, b) => a - b)
      .map((year) => {
        const yearGpas = cohortGpas.get(year) ?? [];
        const yearRadar = this.buildRadarFromSums(
          plos,
          cohortPloSums.get(year) ?? new Map(),
        );
        const ranked = this.rankStrengthsAndWeaknesses(yearRadar);
        return {
          curriculumId,
          admissionYear: year,
          studentCount: students.filter((s) => s.admissionYear === year).length,
          averageGpa: yearGpas.length > 0 ? this.average(yearGpas) : null,
          gpaSampleSize: yearGpas.length,
          radar: yearRadar,
          strengths: ranked.strengths,
          areasForImprovement: ranked.areasForImprovement,
        };
      });
  }

  // Separate data shape from the student loop, but fetched the same way:
  // one query for every course's records and one for every course's CLOs,
  // instead of calculateForCourse's four queries per course. The
  // achievement bar itself still comes from CloAchievementService
  // (CONVENTIONS.md §6) — only the fetching moved.
  private async buildCourseAnalytics(curriculumId: string): Promise<{
    courseAnalytics: CourseAnalyticsEntry[];
    lowestClos: LowestCloEntry[];
  }> {
    const courses = await this.prisma.course.findMany({
      where: { curriculumId, isActive: true },
      orderBy: { code: 'asc' },
    });
    const courseIds = courses.map((course) => course.id);

    const courseRecords =
      await this.studentCourseRecordService.findActiveRecordsForCourses(
        courseIds,
      );
    const recordsByCourse = groupBy(courseRecords, (record) => record.courseId);

    const allClos = await this.prisma.clo.findMany({
      where: { courseId: { in: courseIds }, isActive: true },
    });
    const closByCourse = groupBy(allClos, (clo) => clo.courseId);

    const courseAnalytics: CourseAnalyticsEntry[] = [];
    let lowestAchievement = Infinity;
    let lowestClos: LowestCloEntry[] = [];

    // Running minimum rather than a second pass, so `lowestClos` keeps the
    // `courses` ordering (code asc) that the query above establishes.
    for (const course of courses) {
      const latestByStudent =
        this.studentCourseRecordService.dedupeLatestPerStudent(
          recordsByCourse.get(course.id) ?? [],
        );
      const { achievementPercent } =
        this.cloAchievementService.summarizeCourseAchievement(latestByStudent);

      courseAnalytics.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        achievementPercent,
      });

      // Every CLO of this course shares achievementPercent — there is no
      // per-CLO percent field (Phase 8 limitation, see TODO.md).
      // A course with no graded student has no percent to rank — it is
      // "no data", not the lowest.
      if (achievementPercent === null) {
        continue;
      }
      for (const clo of closByCourse.get(course.id) ?? []) {
        if (achievementPercent < lowestAchievement) {
          lowestAchievement = achievementPercent;
          lowestClos = [];
        }
        if (achievementPercent === lowestAchievement) {
          lowestClos.push({
            cloId: clo.id,
            code: clo.code,
            description: clo.description,
            courseId: course.id,
            courseCode: course.code,
            courseName: course.name,
            achievementPercent,
          });
        }
      }
    }

    return { courseAnalytics, lowestClos };
  }

  private pushInto<K>(map: Map<K, number[]>, key: K, value: number) {
    const existing = map.get(key);
    if (existing) {
      existing.push(value);
    } else {
      map.set(key, [value]);
    }
  }

  // The three helpers below are pure and public because the system-wide
  // curriculum overview runs the same PLO math over data it fetched for
  // every curriculum at once. Keeping them here rather than copying the
  // weighting into the dashboard service is the point (CONVENTIONS.md §6)
  // — a PLO number means the same thing wherever it is shown.
  accumulateRadar(
    sums: Map<string, { sum: number; count: number }>,
    radar: RadarPoint[],
  ) {
    for (const point of radar) {
      if (point.value === null) {
        continue; // no data for this student/PLO — excluded, not zero
      }
      const entry = sums.get(point.ploId) ?? { sum: 0, count: 0 };
      entry.sum += point.value;
      entry.count += 1;
      sums.set(point.ploId, entry);
    }
  }

  buildRadarFromSums(
    plos: PloWithMappings[],
    sums: Map<string, { sum: number; count: number }>,
  ): RadarPoint[] {
    return plos.map((plo) => {
      const entry = sums.get(plo.id);
      return {
        ploId: plo.id,
        code: plo.code,
        name: plo.name,
        value: entry ? entry.sum / entry.count : null,
      };
    });
  }

  private average(values: number[]) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Pure — no I/O, takes already-fetched data, so curriculum-wide and
  // system-wide callers reuse it without re-fetching curriculum.plos per
  // student.
  computeStudentPloScores(
    plos: PloWithMappings[],
    latestAttemptsByCourse: Map<string, LatestCourseAttempt>,
  ): RadarPoint[] {
    return plos.map((plo) => {
      let weightedScoreSum = 0;
      let weightSum = 0;

      for (const mapping of plo.cloMappings) {
        const score = this.scoreForClo(
          mapping.clo.courseId,
          latestAttemptsByCourse,
        );
        if (score === null) {
          continue; // no data for this CLO — excluded, not zero
        }
        weightedScoreSum += score * mapping.weight;
        weightSum += mapping.weight;
      }

      return {
        ploId: plo.id,
        code: plo.code,
        name: plo.name,
        value: weightSum > 0 ? weightedScoreSum / weightSum : null,
      };
    });
  }

  // Same math as computeStudentPloScores, but for the single-student report
  // — also keeps the per-CLO scoreForClo result (normally discarded once
  // weighted into the PLO average) so the page can render a "why" behind
  // each PLO number. Kept as its own method rather than adding an optional
  // param to computeStudentPloScores so the 3 lean call sites (Cohort/
  // Curriculum/Course, which query the thinner PloWithMappings shape) stay
  // untouched.
  private computeStudentPloScoresWithBreakdown(
    plos: PloWithMappingsAndCloDetail[],
    latestAttemptsByCourse: Map<string, LatestCourseAttempt>,
    defaultThreshold: number,
  ): StudentPloRadarPoint[] {
    return plos.map((plo) => {
      let weightedScoreSum = 0;
      let weightSum = 0;
      const cloBreakdown: StudentPloCloBreakdownEntry[] = [];

      for (const mapping of plo.cloMappings) {
        const score = this.scoreForClo(
          mapping.clo.courseId,
          latestAttemptsByCourse,
        );
        if (score !== null) {
          weightedScoreSum += score * mapping.weight;
          weightSum += mapping.weight;
        }

        const threshold = mapping.clo.achievementThreshold ?? defaultThreshold;
        cloBreakdown.push({
          cloId: mapping.clo.id,
          code: mapping.clo.code,
          description: mapping.clo.description,
          courseId: mapping.clo.courseId,
          courseCode: mapping.clo.course.code,
          courseName: mapping.clo.course.name,
          score,
          isAchieved: score !== null && score >= threshold,
        });
      }

      return {
        ploId: plo.id,
        code: plo.code,
        name: plo.name,
        value: weightSum > 0 ? weightedScoreSum / weightSum : null,
        cloBreakdown,
      };
    });
  }

  // Per-student, per-CLO score on a 0-100 scale, keyed off GRADE_STATUS
  // (not GRADE_POINTS alone) — a deliberate divergence from Phase 8's
  // ACHIEVED_GRADES (binary B+/not), since a radar percentage needs a
  // continuous value, not a pass/fail signal.
  //
  // FAIL (F or U) -> 0: counts and drags the PLO down. U is a definite
  // negative outcome, the S/U-scale equivalent of F — excluding it would
  // let a real failure silently vanish from the PLO average.
  // Otherwise, if GRADE_POINTS has a value -> grade/4.0*100.
  // Otherwise (S, W, I) -> excluded (no data): S can't be quantified on a
  // mastery scale; W/I have no final outcome yet.
  private scoreForClo(
    courseId: string,
    latestAttemptsByCourse: Map<string, LatestCourseAttempt>,
  ): number | null {
    const attempt = latestAttemptsByCourse.get(courseId);
    if (!attempt) {
      return null;
    }
    return gradeToScore(attempt.grade);
  }

  private rankStrengthsAndWeaknesses(radar: RadarPoint[]) {
    const withData = radar
      .filter((p): p is RadarPoint & { value: number } => p.value !== null)
      .sort((a, b) => b.value - a.value);

    const strengths = withData.slice(0, STRENGTH_COUNT);
    const remaining = withData.slice(STRENGTH_COUNT);
    const areasForImprovement = remaining
      .slice(-STRENGTH_COUNT)
      .reverse(); // lowest first

    return { strengths, areasForImprovement };
  }

  private isSelfServiceOnly(user: RequestUser) {
    return (
      user.roles.includes('STUDENT') && !user.roles.includes('SUPER_ADMIN')
    );
  }

  private async resolveOwnProfileOrValidate(
    suppliedStudentProfileId: string,
    user: RequestUser,
  ): Promise<StudentProfile> {
    if (this.isSelfServiceOnly(user)) {
      const own = await this.studentProfileService.findByUserId(user.userId);
      if (own.id !== suppliedStudentProfileId) {
        throw new NotFoundException(
          `Student profile ${suppliedStudentProfileId} not found`,
        );
      }
      return own;
    }
    return this.studentProfileService.findActiveByIdOrThrow(
      suppliedStudentProfileId,
    );
  }
}
