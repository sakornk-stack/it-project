import type { InstructorCourseSummary, SemesterTerm } from '@eduanalyze-ai/shared-types';
import { countLowGradePeople } from './follow-ups';
import { INSUFFICIENT_BELOW } from './instructor-overview';
import { NO_LOW_GRADE, isLowGrade } from './low-grade';
import { hasCloPercent } from './clo-percent';

// Pure, rule-based reading of the instructor dashboard response. It only reads
// what GET /dashboard/instructor returned, so it stays inside the "courses I
// teach" scope by construction.

export const NO_STUDENTS_SUMMARY = 'ยังไม่มีนิสิตในรายวิชาที่คุณสอน จึงยังสรุปผลไม่ได้';

const isPositiveCount = (n: number) => Number.isFinite(n) && n > 0;

// Weighted by studentCount — a plain mean of per-course percentages would
// let a 1-student course count as much as a 60-student one.
export function overallAchievementPercent(
  courses: readonly Pick<InstructorCourseSummary, 'studentCount' | 'achievementPercent'>[],
): number | null {
  const counted = courses.filter(
    (c) => isPositiveCount(c.studentCount) && hasCloPercent(c.achievementPercent),
  );
  const totalStudents = counted.reduce((sum, c) => sum + c.studentCount, 0);
  if (totalStudents === 0) return null;
  const achieved = counted.reduce(
    (sum, c) => sum + (c.achievementPercent! * c.studentCount) / 100,
    0,
  );
  return (achieved / totalStudents) * 100;
}

export type AchievementChangeDirection = 'up' | 'down' | 'flat';

export interface AchievementChange {
  direction: AchievementChangeDirection;
  // Signed percentage points (latest − previous); 0 when flat.
  delta: number;
  // Students behind the latest term's figure, so a swing from a tiny term reads as one.
  latestStudentCount: number;
}

// Mirrors the backend's SEMESTER_TERM_RANK (grade-point.constant.ts).
export const SEMESTER_TERM_RANK: Record<SemesterTerm, number> = { FIRST: 1, SECOND: 2, SUMMER: 3 };

// Below half a point the change rounds to 0 at the whole points we show.
const FLAT_BELOW = 0.5;

type SemesterTotal = {
  academicYear: number;
  semesterTerm: SemesterTerm;
  students: number;
  achieved: number;
};

// Latest semester vs the one before it, across every course the instructor
// teaches. Each semesterTrend point is (students graded B+ / students with a
// letter grade, gradedCount — S/U are not in it) for one course in one term,
// so rounding percent × gradedCount recovers the exact head count and the
// cross-course figure is a true pooled percentage, not an average of averages.
// Fewer than two semesters with graded students → null.
export function computeAchievementChange(
  courses: readonly Pick<InstructorCourseSummary, 'semesterTrend'>[],
): AchievementChange | null {
  const bySemester = new Map<string, SemesterTotal>();
  for (const course of courses) {
    for (const point of course.semesterTrend) {
      if (!isPositiveCount(point.gradedCount) || !Number.isFinite(point.achievementPercent))
        continue;
      if (!(point.semesterTerm in SEMESTER_TERM_RANK)) continue;
      const key = `${point.academicYear}:${point.semesterTerm}`;
      const total = bySemester.get(key) ?? {
        academicYear: point.academicYear,
        semesterTerm: point.semesterTerm,
        students: 0,
        achieved: 0,
      };
      total.students += point.gradedCount;
      total.achieved += Math.round((point.achievementPercent * point.gradedCount) / 100);
      bySemester.set(key, total);
    }
  }

  const ordered = [...bySemester.values()].sort(
    (a, b) =>
      a.academicYear - b.academicYear ||
      SEMESTER_TERM_RANK[a.semesterTerm] - SEMESTER_TERM_RANK[b.semesterTerm],
  );
  if (ordered.length < 2) return null;

  const percent = (t: SemesterTotal) => (t.achieved / t.students) * 100;
  const latest = ordered[ordered.length - 1];
  const delta = percent(latest) - percent(ordered[ordered.length - 2]);
  if (!Number.isFinite(delta)) return null;
  const latestStudentCount = latest.students;
  if (Math.abs(delta) < FLAT_BELOW) return { direction: 'flat', delta: 0, latestStudentCount };
  return { direction: delta > 0 ? 'up' : 'down', delta, latestStudentCount };
}

// "นิสิต 9 คน" + this reads as one sentence; LOW_GRADE_LABEL is the noun form.
const LOW_GRADE_VERB = 'ได้ D+ ลงไป';

// Fewer people than this in the latest term and a swing of tens of points is
// noise, so the line says the data is thin rather than celebrating or alarming.
const THIN_DATA_BELOW = 5;

// Says "เทอมล่าสุด" because the headline figure beside it is cumulative while
// this compares single terms, and names the latest term's head count first so
// it cannot be read as the previous term's. `signed` adds the +/− sign for badges.
export function formatAchievementChange(
  change: AchievementChange,
  { signed }: { signed: boolean },
): string {
  const thin = change.latestStudentCount < THIN_DATA_BELOW ? ' (ข้อมูลน้อย)' : '';
  const term = `เทอมล่าสุด ${change.latestStudentCount} คน${thin}:`;
  if (change.direction === 'flat') return `– ${term} เท่ากับเทอมก่อน`;
  const points = Math.round(Math.abs(change.delta));
  if (change.direction === 'up')
    return `${term} ▲ ดีขึ้น ${signed ? '+' : ''}${points} จุดจากเทอมก่อน`;
  return `${term} ▼ แย่ลง ${signed ? '−' : ''}${points} จุดจากเทอมก่อน`;
}

// Enough people with a letter grade to judge the course against its bar; under
// INSUFFICIENT_BELOW the course page gives no verdict, and neither does this.
type Judged = Pick<
  InstructorCourseSummary,
  'studentCount' | 'achievementPercent' | 'achievementThreshold'
>;

export function hasVerdict<T extends Judged>(c: T): c is T & { achievementPercent: number } {
  return (
    isPositiveCount(c.studentCount) &&
    c.studentCount >= INSUFFICIENT_BELOW &&
    hasCloPercent(c.achievementPercent) &&
    Number.isFinite(c.achievementThreshold)
  );
}

// Points from the course's own bar: negative = short of it. Courses can sit in
// curricula with different bars, so this, not the raw percentage, says which is
// furthest behind.
const gapOf = (c: { achievementPercent: number; achievementThreshold: number }) =>
  c.achievementPercent - c.achievementThreshold;

// Furthest below its bar first, then courses too small to judge, then courses
// without a grade — the same order the summary's "เริ่มที่" course uses, so the
// two agree. Within the last two groups the input order is kept.
export function sortCoursesByAttention<
  T extends Judged,
>(courses: readonly T[]): T[] {
  const rank = (c: T) => {
    if (hasVerdict(c)) return gapOf(c);
    if (isPositiveCount(c.studentCount) && hasCloPercent(c.achievementPercent))
      return Number.MAX_VALUE;
    return Number.POSITIVE_INFINITY;
  };
  // Infinity − Infinity is NaN: `|| 0` keeps two ungraded courses as they were.
  return [...courses].sort((a, b) => rank(a) - rank(b) || 0);
}

// Up to three plain sentences for the top of the dashboard: which courses are
// short of their bar, who has a low grade, and the pooled share with its change
// since the term before. Every part is dropped when its data is missing or not a
// real number, so no line shows undefined/NaN. null = no courses at all (the page
// shows its own notice).
export function buildInstructorSummary(
  courses: readonly InstructorCourseSummary[],
): string[] | null {
  if (courses.length === 0) return null;
  if (!courses.some((c) => isPositiveCount(c.studentCount))) return [NO_STUDENTS_SUMMARY];

  const lines: string[] = [];

  const judged = courses.filter(hasVerdict);
  const below = sortCoursesByAttention(
    judged.filter((c) => c.achievementPercent < c.achievementThreshold),
  );
  if (below.length > 0) {
    const first = below[0];
    lines.push(
      `${below.length} จาก ${judged.length} วิชายังไม่ถึงเกณฑ์ ` +
        `เริ่มที่ ${first.code} ${first.name} ${Math.round(first.achievementPercent)}% ` +
        `(เกณฑ์ ${first.achievementThreshold}%)`,
    );
  } else if (judged.length > 0) {
    lines.push(
      judged.length < courses.length
        ? `ทุกวิชาที่มีนิสิตพอจะสรุปได้ถึงเกณฑ์ (${judged.length} จาก ${courses.length} วิชา)`
        : 'ทุกวิชาถึงเกณฑ์',
    );
  } else if (courses.some((c) => hasCloPercent(c.achievementPercent))) {
    lines.push(`ยังสรุปเทียบเกณฑ์ไม่ได้ เพราะทุกวิชามีนิสิตที่ได้เกรดไม่ถึง ${INSUFFICIENT_BELOW} คน`);
  }

  const lowGradePeople = countLowGradePeople(courses);
  if (lowGradePeople > 0) {
    const lowGradeCourses = courses.filter((c) =>
      c.atRiskStudents.some((s) => isLowGrade(s.grade)),
    ).length;
    lines.push(`นิสิต ${lowGradePeople} คน${LOW_GRADE_VERB} ใน ${lowGradeCourses} วิชา`);
  } else {
    lines.push(NO_LOW_GRADE);
  }

  const overall = overallAchievementPercent(courses);
  if (overall !== null) {
    const change = computeAchievementChange(courses);
    let line = `รวมทุกวิชาได้ B ขึ้นไป ${Math.round(overall)}%`;
    // The flat form opens with a dash of its own; after " · " it would read as two.
    if (change) line += ` · ${formatAchievementChange(change, { signed: false }).replace(/^– /, '')}`;
    lines.push(line);
  }

  return lines;
}
