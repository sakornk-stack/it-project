import type {
  Grade,
  InstructorCourseSummary,
  RiskLevel,
  SemesterTerm,
} from '@eduanalyze-ai/shared-types';
import { buildTrendTerms, trendChangeOf, type TrendChange } from './course-snapshot';
import { hasCloPercent } from './clo-percent';
import { GRADE_POINTS, statusOf, type OverviewStatus } from './instructor-overview';
import { hasVerdict, sortCoursesByAttention } from './instructor-summary';
import { isLowGrade } from './low-grade';

// The instructor dashboard: every course on one page. Pure; it only regroups
// GET /dashboard/instructor (the courses the caller teaches), so it stays inside
// that scope by construction and adds no rule of its own.

// ---- courses, furthest below their bar first ----

// 'few' = graded, but too few people for a verdict (the course page gives none either).
export type AttentionStatus = OverviewStatus | 'few';

export interface AttentionRow {
  course: InstructorCourseSummary;
  // The backend's share at B or above (A to F only); null = no letter grade yet.
  percent: number | null;
  threshold: number | null;
  status: AttentionStatus;
  // People with a letter grade, the base of `percent`.
  graded: number;
  // People whose latest grade in this course is D+, D, F or U.
  lowGrade: number;
  // Latest term against the one before, when both have enough people.
  change: TrendChange | null;
  // Whole points short of the bar (1 or more); null when at the bar, or no verdict.
  shortBy: number | null;
  // The course's latest term with a grade, e.g. "ภาคต้น / 2569".
  termLabel: string | null;
}

export function buildAttentionRows(courses: readonly InstructorCourseSummary[]): AttentionRow[] {
  return sortCoursesByAttention(courses).map((course) => {
    const threshold = Number.isFinite(course.achievementThreshold)
      ? course.achievementThreshold
      : null;
    const percent = hasCloPercent(course.achievementPercent) ? course.achievementPercent : null;
    let status: AttentionStatus;
    if (hasVerdict(course)) status = statusOf(course.achievementPercent, threshold);
    else status = percent !== null && course.studentCount > 0 ? 'few' : 'none';
    const terms = buildTrendTerms(course.semesterTrend);
    const short =
      percent !== null && threshold !== null && (status === 'below' || status === 'near')
        ? Math.round(threshold - percent)
        : 0;
    return {
      course,
      percent,
      threshold,
      status,
      shortBy: short >= 1 ? short : null,
      termLabel: terms[terms.length - 1]?.label ?? null,
      graded: Math.max(0, course.studentCount),
      lowGrade: course.atRiskStudents.filter((s) => isLowGrade(s.grade)).length,
      change: trendChangeOf(terms),
    };
  });
}

// ---- people to follow up: one row per student and course ----

export interface FollowUpRow {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  grade: Grade;
  riskLevel: RiskLevel;
  academicYear: number;
  semesterTerm: SemesterTerm;
  courseId: string;
  courseCode: string;
  courseName: string;
}

// U carries no grade point but is a fail, so it sorts with F.
const severity = (grade: Grade) => GRADE_POINTS[grade] ?? 0;

// Worst grade first; between equal grades, the course that needs attention
// first, then the student code. `people` counts a student with low grades in
// two courses once; `total` counts rows.
export function selectFollowUps(
  courses: readonly InstructorCourseSummary[],
  max = 5,
): { rows: FollowUpRow[]; total: number; people: number } {
  const courseOrder = new Map(
    sortCoursesByAttention(courses).map((c, i) => [c.courseId, i] as const),
  );
  const all: FollowUpRow[] = courses.flatMap((course) =>
    course.atRiskStudents
      .filter((s) => isLowGrade(s.grade))
      .map((s) => ({
        studentProfileId: s.studentProfileId,
        studentCode: s.studentCode,
        fullName: s.fullName,
        grade: s.grade,
        riskLevel: s.riskLevel,
        academicYear: s.academicYear,
        semesterTerm: s.semesterTerm,
        courseId: course.courseId,
        courseCode: course.code,
        courseName: course.name,
      })),
  );
  all.sort(
    (a, b) =>
      severity(a.grade) - severity(b.grade) ||
      (courseOrder.get(a.courseId) ?? 0) - (courseOrder.get(b.courseId) ?? 0) ||
      a.studentCode.localeCompare(b.studentCode),
  );
  return {
    rows: all.slice(0, Math.max(0, max)),
    total: all.length,
    people: new Set(all.map((r) => r.studentProfileId)).size,
  };
}
