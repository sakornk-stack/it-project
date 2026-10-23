import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StudentProfile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentProfileService } from '../../users/student-profile/student-profile.service';
import { creditsRemaining } from '../../../common/academic/credit-progress';
import { GRADE_STATUS } from '../student-course-record/grade-point.constant';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from '../student-course-record/student-course-record.service';
import {
  CategoryProgress,
  CourseSummary,
  CreditCheckReport,
  GraduationReadiness,
} from './credit-checker-report.interface';

// Shared by the singular and batched loaders below so their trees are
// identical by construction rather than by two include blocks staying in
// sync by hand.
const CURRICULUM_TREE_INCLUDE = {
  categories: {
    where: { isActive: true },
    include: {
      requirement: true,
      courses: {
        where: { isActive: true },
        include: { prerequisitesRequired: true },
      },
    },
  },
} satisfies Prisma.CurriculumInclude;

// Colocated with the service that produces it, same pattern as
// LatestCourseAttempt in student-course-record.service.ts.
export type CreditCheckCurriculumTree = Prisma.CurriculumGetPayload<{
  include: {
    categories: {
      include: {
        requirement: true;
        courses: { include: { prerequisitesRequired: true } };
      };
    };
  };
}>;

type CourseStatus = 'PASS' | 'FAIL' | 'EXCLUDED';

// No record at all is treated the same as W/I — see grade-point.constant.ts
// on GRADE_STATUS. Shared by computeCreditCheck and computePassedCourseIds
// so the two passes can never disagree on what "passed" means.
function resolveCourseStatus(
  attempt: LatestCourseAttempt | undefined,
): CourseStatus {
  return attempt ? GRADE_STATUS[attempt.grade] : 'EXCLUDED';
}

// requirement is nullable (1:1, a category may have no CurriculumRequirement
// row) — treat as always-satisfied rather than crashing on null.minCredits.
function resolveCategoryRequirement(
  requirement: { minCredits: number; minCourses: number | null } | null,
): { minCredits: number; minCourses: number | null } {
  return {
    minCredits: requirement?.minCredits ?? 0,
    minCourses: requirement?.minCourses ?? null,
  };
}

function isCategoryComplete(
  creditsEarned: number,
  coursesPassedCount: number,
  minCredits: number,
  minCourses: number | null,
): boolean {
  return (
    creditsEarned >= minCredits &&
    (minCourses === null || coursesPassedCount >= minCourses)
  );
}

function computeGraduationReadiness(
  creditsPassed: number,
  totalCreditsRequired: number,
  categoryProgress: CategoryProgress[],
  missingRequiredCount: number,
): GraduationReadiness {
  const creditsMet = creditsPassed >= totalCreditsRequired;
  const allCategoriesMet = categoryProgress.every((c) => c.isComplete);
  return {
    isReady: creditsMet && allCategoriesMet && missingRequiredCount === 0,
    creditsMet,
    allCategoriesMet,
    missingRequiredCount,
  };
}

@Injectable()
export class CreditCheckerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentProfileService: StudentProfileService,
    private readonly studentCourseRecordService: StudentCourseRecordService,
  ) {}

  async checkCredits(
    studentProfileId: string,
    user: RequestUser,
  ): Promise<CreditCheckReport> {
    const profile = await this.resolveOwnProfileOrValidate(
      studentProfileId,
      user,
    );
    return this.checkCreditsForProfile(profile);
  }

  // The report for a profile whose access the caller has already checked
  // (checkCredits above; AdvisorService for an advisee).
  async checkCreditsForProfile(
    profile: Pick<StudentProfile, 'id' | 'curriculumId'>,
  ): Promise<CreditCheckReport> {
    const curriculum = await this.loadCurriculumTree(profile.curriculumId);

    const latestByCourse =
      await this.studentCourseRecordService.getLatestAttemptsPerCourse(
        profile.id,
      );

    return this.computeCreditCheck(profile, curriculum, latestByCourse);
  }

  // Extracted so curriculum-wide callers (Phase 9 Chunk 4+) can fetch the
  // curriculum tree ONCE and reuse it across many students, instead of
  // re-fetching it per student the way checkCredits does for a single one.
  async loadCurriculumTree(
    curriculumId: string,
  ): Promise<CreditCheckCurriculumTree> {
    return this.prisma.curriculum.findUniqueOrThrow({
      where: { id: curriculumId },
      include: CURRICULUM_TREE_INCLUDE,
    });
  }

  // Batched sibling of loadCurriculumTree — one round trip for every
  // curriculum in the system instead of one per curriculum. Same include
  // shape, so both return the identical tree; only the fetch granularity
  // differs. Missing ids are simply absent from the map (unlike the
  // singular version's findUniqueOrThrow), because a system-wide caller
  // asks for whatever exists rather than asserting one known id.
  async loadCurriculumTrees(
    curriculumIds: string[],
  ): Promise<Map<string, CreditCheckCurriculumTree>> {
    if (curriculumIds.length === 0) return new Map();
    const curricula = await this.prisma.curriculum.findMany({
      where: { id: { in: curriculumIds } },
      include: CURRICULUM_TREE_INCLUDE,
    });
    return new Map(curricula.map((curriculum) => [curriculum.id, curriculum]));
  }

  // Pure/internal — no I/O, no ownership check, takes already-fetched
  // data. Extracted (same shape as calculateGpaFromAttempts in Phase 9
  // Chunk 3) so curriculum-wide callers can reuse the exact same
  // computation without re-fetching the curriculum tree per student.
  computeCreditCheck(
    profile: Pick<StudentProfile, 'id' | 'curriculumId'>,
    curriculum: CreditCheckCurriculumTree,
    latestByCourse: Map<string, LatestCourseAttempt>,
  ): CreditCheckReport {
    // Per PROJECT_CONTEXT.md §18: every metric below is computed by
    // iterating the STUDENT'S OWN curriculum's courses and looking each up
    // in the latest-attempts map — never by summing the map directly
    // (unlike calculateGpa, which is a whole-transcript metric, not
    // curriculum-scoped). This guards against a stray record pointing at
    // a course from a different curriculum ever leaking into these totals.

    // First pass: which courses in this curriculum has the student passed?
    // Needed up front so the prerequisite check below doesn't depend on
    // category iteration order.
    const passedCourseIds = this.computePassedCourseIds(
      curriculum,
      latestByCourse,
    );

    const passedCourses: CourseSummary[] = [];
    const failedCourses: CourseSummary[] = [];
    const notYetStudiedCourses: CourseSummary[] = [];
    const missingRequiredCourses: (CourseSummary & {
      isPrerequisiteSatisfied: boolean;
    })[] = [];
    const categoryProgress: CategoryProgress[] = [];

    let creditsStudied = 0;
    let creditsPassed = 0;

    for (const category of curriculum.categories) {
      let categoryCreditsEarned = 0;
      let categoryCoursesPassedCount = 0;

      for (const course of category.courses) {
        const attempt = latestByCourse.get(course.id);
        const status = resolveCourseStatus(attempt);
        const summary = this.buildCourseSummary(
          course,
          category.id,
          attempt,
          passedCourseIds,
        );

        if (status === 'PASS') {
          passedCourses.push(summary);
          creditsStudied += course.credits;
          creditsPassed += course.credits;
          categoryCreditsEarned += course.credits;
          categoryCoursesPassedCount += 1;
        } else if (status === 'FAIL') {
          failedCourses.push(summary);
          creditsStudied += course.credits;
        } else {
          // EXCLUDED (W/I) or no record at all — same bucket, see
          // grade-point.constant.ts comment on GRADE_STATUS.
          notYetStudiedCourses.push(summary);
        }

        if (course.isRequired && status !== 'PASS') {
          missingRequiredCourses.push(summary);
        }
      }

      const { minCredits, minCourses } = resolveCategoryRequirement(
        category.requirement,
      );
      const isComplete = isCategoryComplete(
        categoryCreditsEarned,
        categoryCoursesPassedCount,
        minCredits,
        minCourses,
      );

      categoryProgress.push({
        categoryId: category.id,
        name: category.name,
        minCredits,
        minCourses,
        creditsEarned: categoryCreditsEarned,
        coursesPassedCount: categoryCoursesPassedCount,
        isComplete,
      });
    }

    const graduationReadiness = computeGraduationReadiness(
      creditsPassed,
      curriculum.totalCredits,
      categoryProgress,
      missingRequiredCourses.length,
    );

    return {
      studentProfileId: profile.id,
      curriculumId: curriculum.id,
      totalCreditsRequired: curriculum.totalCredits,
      creditsStudied,
      creditsPassed,
      // Alias — see credit-checker-report.interface.ts comment.
      creditsAccumulated: creditsPassed,
      creditsRemaining: creditsRemaining(
        curriculum.totalCredits,
        creditsPassed,
      ),
      passedCourses,
      failedCourses,
      notYetStudiedCourses,
      missingRequiredCourses,
      categoryProgress,
      graduationReadiness,
    };
  }

  // isPrerequisiteSatisfied is computed for every course (not just
  // required-and-not-passed) — the Prerequisite Flow Chart needs it for
  // every node, and it's free: prerequisitesRequired/passedCourseIds are
  // already in memory from loadCurriculumTree/computePassedCourseIds.
  private buildCourseSummary(
    course: CreditCheckCurriculumTree['categories'][number]['courses'][number],
    categoryId: string,
    attempt: LatestCourseAttempt | undefined,
    passedCourseIds: Set<string>,
  ): CourseSummary {
    return {
      courseId: course.id,
      code: course.code,
      name: course.name,
      credits: course.credits,
      grade: attempt?.grade,
      isRequired: course.isRequired,
      categoryId,
      prerequisiteCourseIds: course.prerequisitesRequired.map(
        (p) => p.prerequisiteCourseId,
      ),
      isPrerequisiteSatisfied: this.isCoursePrerequisiteSatisfied(
        course,
        passedCourseIds,
      ),
    };
  }

  // Pure/internal — no I/O. Extracted (same reasoning as
  // loadCurriculumTree/computeCreditCheck in Phase 9 Chunk 4) so
  // LearningPathService can reuse the exact same "which courses has this
  // student passed" computation instead of re-deriving it.
  computePassedCourseIds(
    curriculum: CreditCheckCurriculumTree,
    latestByCourse: Map<string, LatestCourseAttempt>,
  ): Set<string> {
    const passedCourseIds = new Set<string>();
    for (const category of curriculum.categories) {
      for (const course of category.courses) {
        const attempt = latestByCourse.get(course.id);
        if (resolveCourseStatus(attempt) === 'PASS') {
          passedCourseIds.add(course.id);
        }
      }
    }
    return passedCourseIds;
  }

  // Pure/internal — no I/O. Extracted so LearningPathService can check
  // prerequisite-eligibility for ANY course (required or elective), not
  // just the required-only subset computeCreditCheck applies this to.
  isCoursePrerequisiteSatisfied(
    course: { prerequisitesRequired: { prerequisiteCourseId: string }[] },
    passedCourseIds: Set<string>,
  ): boolean {
    return course.prerequisitesRequired.every((p) =>
      passedCourseIds.has(p.prerequisiteCourseId),
    );
  }

  private isSelfServiceOnly(user: RequestUser) {
    return (
      user.roles.includes('STUDENT') && !user.roles.includes('SUPER_ADMIN')
    );
  }

  // Same self-ownership shape as StudentCourseRecordService, but returns
  // the full StudentProfile row (not just the id) since checkCredits needs
  // profile.curriculumId next.
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
