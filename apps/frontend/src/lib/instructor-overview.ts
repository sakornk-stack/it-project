import type { CloAchievementEntry, Grade, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { formatPercent } from './format-percent';
import type { SemanticTone } from './tone';

// Academic overview for the instructor pages: how well students are doing, by
// course and by year level. Pure; it only regroups the grades the backend
// already returned (GET /dashboard/instructor for the per-course tally,
// GET /dashboard/instructor/students for one row per student and course) and
// the credits of each course. It adds no rule of its own about who is at risk:
// that stays with riskLevel() on the students page.

// Mirrors GRADE_POINTS in apps/backend/.../grade-point.constant.ts (the Thai
// 4-point scale; null = does not affect the average). Kept in step by hand, the
// same way clo-achievement-section mirrors ACHIEVED_GRADES.
export const GRADE_POINTS: Record<Grade, number | null> = {
  A: 4,
  B_PLUS: 3.5,
  B: 3,
  C_PLUS: 2.5,
  C: 2,
  D_PLUS: 1.5,
  D: 1,
  F: 0,
  W: null,
  I: null,
  S: null,
  U: null,
};

// "B or above". Mirrors ACHIEVED_GRADES in the backend.
export const ACHIEVED_GRADES: ReadonlySet<Grade> = new Set<Grade>(['A', 'B_PLUS', 'B']);

// Withdrawn and incomplete never finished the course, so they are left out of
// the share that reached B (the backend's GRADE_STATUS 'EXCLUDED').
export const NOT_COUNTED_GRADES: ReadonlySet<Grade> = new Set<Grade>(['W', 'I']);

export const ALL_GRADES = Object.keys(GRADE_POINTS) as Grade[];

// Fewer graded people than this and no verdict is given at all.
export const INSUFFICIENT_BELOW = 5;
// Fewer people than this and a percentage swings on a single student.
export const LOW_SAMPLE_BELOW = 10;
// "Close to the goal": under it by no more than this many percentage points.
export const NEAR_GOAL_POINTS = 5;

export type GradeCounts = Record<Grade, number>;

export const emptyCounts = (): GradeCounts =>
  Object.fromEntries(ALL_GRADES.map((g) => [g, 0])) as GradeCounts;

export function tallyGrades(grades: readonly Grade[]): GradeCounts {
  const counts = emptyCounts();
  for (const g of grades) if (g in counts) counts[g] += 1;
  return counts;
}

const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface GroupStats {
  // Everyone with a grade, W and I included.
  seats: number;
  // Seats minus W and I: the base of the "B or above" share.
  counted: number;
  // People with a grade from A to F (no W, I, S, U): the one base for every
  // "too few people" note, whatever the page.
  graded: number;
  achieved: number;
  // null when nobody counts yet.
  achievedPercent: number | null;
  // Credit-weighted grade average; null when no grade carries a point.
  gpa: number | null;
  f: number;
  w: number;
  lowSample: boolean;
  counts: GradeCounts;
}

interface Part {
  counts: GradeCounts;
  // Credits of the course these seats belong to (weights the grade average).
  // null = not known: never replaced by a guess.
  credits: number | null;
}

// One group of seats, possibly from several courses. Share of B or above is
// weighted by seat (every counted seat is one); the grade average is weighted
// by credits, like the backend's GPA, so a 3-credit course counts more than a
// 1-credit one. Within a single course that is just the mean, so one part needs
// no credits. With several parts, one whose credits are unknown makes the
// average unknown (null) instead of being treated as 1 credit.
export function summarizeParts(parts: readonly Part[]): GroupStats {
  const counts = emptyCounts();
  let pointSum = 0;
  let creditSum = 0;
  let creditsMissing = false;
  for (const { counts: c, credits } of parts) {
    const known = num(credits) && credits > 0;
    const w = known ? credits : 1;
    for (const g of ALL_GRADES) {
      const n = c[g] ?? 0;
      counts[g] += n;
      const point = GRADE_POINTS[g];
      if (point !== null) {
        if (n > 0 && !known && parts.length > 1) creditsMissing = true;
        pointSum += n * point * w;
        creditSum += n * w;
      }
    }
  }
  const seats = ALL_GRADES.reduce((sum, g) => sum + counts[g], 0);
  const counted = ALL_GRADES.reduce((sum, g) => (NOT_COUNTED_GRADES.has(g) ? sum : sum + counts[g]), 0);
  const graded = ALL_GRADES.reduce((sum, g) => (GRADE_POINTS[g] === null ? sum : sum + counts[g]), 0);
  const achieved = ALL_GRADES.reduce((sum, g) => (ACHIEVED_GRADES.has(g) ? sum + counts[g] : sum), 0);
  return {
    seats,
    counted,
    graded,
    achieved,
    achievedPercent: counted > 0 ? (achieved / counted) * 100 : null,
    gpa: creditSum > 0 && !creditsMissing ? pointSum / creditSum : null,
    f: counts.F,
    w: counts.W,
    lowSample: graded < LOW_SAMPLE_BELOW,
    counts,
  };
}

// ---- status (Instructor only; the shared achievementStatus() is untouched) ----

export type OverviewStatus = 'met' | 'near' | 'below' | 'none';

export const STATUS_META: Record<OverviewStatus, { label: string; tone: SemanticTone }> = {
  met: { label: 'ถึงเกณฑ์', tone: 'success' },
  near: { label: 'ใกล้เกณฑ์', tone: 'warning' },
  // Amber, never red: under the bar is a to-do, the same rule as plo-color.ts.
  below: { label: 'ต่ำกว่าเกณฑ์', tone: 'warning' },
  none: { label: 'ยังไม่มีเกรด', tone: 'neutral' },
};

export function statusOf(percent: number | null, target: number | null): OverviewStatus {
  if (percent === null || !num(percent)) return 'none';
  if (target === null || !num(target)) return 'none';
  if (percent >= target) return 'met';
  return target - percent <= NEAR_GOAL_POINTS ? 'near' : 'below';
}

// ---- per course ----

export interface CourseOverview {
  course: InstructorCourseSummary;
  stats: GroupStats;
  target: number | null;
  status: OverviewStatus;
  // Points short of the target (positive = short, negative = above); null when unknown.
  gap: number | null;
}

export type CreditsByCourse = ReadonlyMap<string, number> | Readonly<Record<string, number>>;

// null when the credits of this course are not known.
const creditsOf = (credits: CreditsByCourse | undefined, courseId: string): number | null => {
  const raw = credits instanceof Map ? credits.get(courseId) : credits?.[courseId as keyof typeof credits];
  return num(raw) && raw > 0 ? raw : null;
};

export function buildCourseOverviews(
  courses: readonly InstructorCourseSummary[],
  credits?: CreditsByCourse,
): CourseOverview[] {
  return courses.map((course) => {
    const counts = { ...emptyCounts(), ...course.gradeDistribution };
    const stats = summarizeParts([{ counts, credits: creditsOf(credits, course.courseId) }]);
    const target = num(course.achievementThreshold) ? course.achievementThreshold : null;
    const status = statusOf(stats.achievedPercent, target);
    const gap = stats.achievedPercent !== null && target !== null ? target - stats.achievedPercent : null;
    return { course, stats, target, status, gap };
  });
}

// Furthest from its goal first; courses without a grade yet last, and ties by code.
export function sortByGap(overviews: readonly CourseOverview[]): CourseOverview[] {
  return [...overviews].sort((a, b) => {
    if ((a.gap === null) !== (b.gap === null)) return a.gap === null ? 1 : -1;
    return (b.gap ?? 0) - (a.gap ?? 0) || a.course.code.localeCompare(b.course.code);
  });
}

export interface OverallOverview {
  stats: GroupStats;
  // Seat-weighted target of the courses that have a grade; null if none.
  target: number | null;
  status: OverviewStatus;
}

export function buildOverallOverview(
  overviews: readonly CourseOverview[],
  credits?: CreditsByCourse,
): OverallOverview {
  const stats = summarizeParts(
    overviews.map((o) => ({
      counts: { ...emptyCounts(), ...o.course.gradeDistribution },
      credits: creditsOf(credits, o.course.courseId),
    })),
  );
  let weight = 0;
  let sum = 0;
  for (const o of overviews) {
    if (o.target !== null && o.stats.counted > 0) {
      weight += o.stats.counted;
      sum += o.target * o.stats.counted;
    }
  }
  const target = weight > 0 ? sum / weight : null;
  return { stats, target, status: statusOf(stats.achievedPercent, target) };
}

// ---- by year level (joined on the student, no new request) ----

export interface SeatRow {
  studentProfileId: string;
  courseId: string;
  grade: Grade;
}

export interface YearLevelCell {
  yearLevel: number;
  stats: GroupStats;
}

// Year level is a property of the student (from the year-levels report); a seat
// whose student is not in that report has no level and is left out of the split
// (it still counts in the course and overall totals, which do not use this).
export function breakdownByYearLevel(
  rows: readonly SeatRow[],
  yearLevelByStudent: ReadonlyMap<string, number>,
  credits?: CreditsByCourse,
): { byCourse: Map<string, YearLevelCell[]>; overall: YearLevelCell[]; unplaced: number } {
  const perCourse = new Map<string, Map<number, Grade[]>>();
  let unplaced = 0;
  for (const row of rows) {
    const level = yearLevelByStudent.get(row.studentProfileId);
    if (level === undefined) {
      unplaced += 1;
      continue;
    }
    const levels = perCourse.get(row.courseId) ?? new Map<number, Grade[]>();
    const list = levels.get(level) ?? [];
    list.push(row.grade);
    levels.set(level, list);
    perCourse.set(row.courseId, levels);
  }

  const byCourse = new Map<string, YearLevelCell[]>();
  const overallParts = new Map<number, Part[]>();
  for (const [courseId, levels] of perCourse) {
    const cells: YearLevelCell[] = [];
    for (const level of [...levels.keys()].sort((a, b) => a - b)) {
      const part = { counts: tallyGrades(levels.get(level)!), credits: creditsOf(credits, courseId) };
      cells.push({ yearLevel: level, stats: summarizeParts([part]) });
      overallParts.set(level, [...(overallParts.get(level) ?? []), part]);
    }
    byCourse.set(courseId, cells);
  }
  const overall = [...overallParts.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({ yearLevel: level, stats: summarizeParts(overallParts.get(level)!) }));
  return { byCourse, overall, unplaced };
}

// ---- learning goals (met / not yet only: the backend has one share per course) ----

export interface GoalRow {
  courseId: string;
  courseCode: string;
  courseName: string;
  cloCode: string;
  description: string;
  met: boolean;
}

// Up to `max` goals, those not yet met first (courses furthest from their goal
// leading), then met ones to fill the list.
export function selectGoals(
  overviews: readonly CourseOverview[],
  max = 5,
): { rows: GoalRow[]; unmet: number; total: number } {
  const rows: GoalRow[] = [];
  for (const o of sortByGap(overviews)) {
    for (const clo of o.course.clos as CloAchievementEntry[]) {
      rows.push({
        courseId: o.course.courseId,
        courseCode: o.course.code,
        courseName: o.course.name,
        cloCode: clo.code,
        description: clo.description,
        met: clo.isAchieved,
      });
    }
  }
  const unmetRows = rows.filter((r) => !r.met);
  const metRows = rows.filter((r) => r.met);
  return {
    rows: [...unmetRows, ...metRows].slice(0, Math.max(0, max)),
    unmet: unmetRows.length,
    total: rows.length,
  };
}

// ---- words ----

export const formatGpa = (gpa: number | null): string => (gpa === null ? '—' : gpa.toFixed(2));

// One line for the header. Leaves out any part with no data; never NaN.
export function buildOverviewSentence(
  overall: OverallOverview,
  overviews: readonly CourseOverview[],
): string | null {
  const { stats } = overall;
  if (stats.counted === 0) return null;
  const parts: string[] = [];
  const meta = STATUS_META[overall.status];
  parts.push(
    `ได้ B ขึ้นไป ${formatPercent(stats.achievedPercent)}` +
      (overall.target !== null ? ` จากเกณฑ์ ${formatPercent(overall.target)} (${meta.label})` : ''),
  );
  if (stats.gpa !== null) parts.push(`เกรดเฉลี่ย ${formatGpa(stats.gpa)}`);
  const worst = sortByGap(overviews).find((o) => o.gap !== null && o.gap > 0);
  if (worst) parts.push(`ห่างเกณฑ์มากสุด ${worst.course.code} ${worst.course.name} ${formatPercent(worst.stats.achievedPercent)}`);
  if (stats.lowSample) parts.push(`นิสิตน้อย (${stats.graded} คน)`);
  return parts.join(' · ');
}

// ---- course x year level matrix ----

export interface MatrixCell {
  yearLevel: number;
  stats: GroupStats;
}

export interface MatrixRow {
  course: InstructorCourseSummary;
  // One entry per column, in the same order as `levels`; null = nobody there ("–").
  cells: (MatrixCell | null)[];
  total: GroupStats;
}

export interface Matrix {
  // The year levels that have anyone, ascending; empty levels are not columns.
  levels: number[];
  rows: MatrixRow[];
  // Seats of the whole table per level, and in total.
  footer: { cells: (MatrixCell | null)[]; total: GroupStats };
  unplaced: number;
}

// Every number comes from the same seats: the per-course total here is the
// course's own counted figure, so a row's total matches its card elsewhere.
// Rows run by course code: no goal decides the order.
export function buildCourseYearMatrix(
  overviews: readonly CourseOverview[],
  seats: readonly SeatRow[],
  yearLevelByStudent: ReadonlyMap<string, number>,
  credits?: CreditsByCourse,
): Matrix {
  const { byCourse, overall, unplaced } = breakdownByYearLevel(seats, yearLevelByStudent, credits);
  const levels = [...new Set(overall.map((c) => c.yearLevel))].sort((a, b) => a - b);
  const all = buildOverallOverview(overviews, credits);
  const cell = (cells: YearLevelCell[] | undefined, level: number): MatrixCell | null => {
    const hit = cells?.find((c) => c.yearLevel === level);
    return hit ? { yearLevel: level, stats: hit.stats } : null;
  };
  return {
    levels,
    rows: [...overviews]
      .sort((a, b) => a.course.code.localeCompare(b.course.code))
      .map((o) => ({
        course: o.course,
        cells: levels.map((l) => cell(byCourse.get(o.course.courseId), l)),
        total: o.stats,
      })),
    footer: {
      cells: levels.map((l) => cell(overall, l)),
      total: all.stats,
    },
    unplaced,
  };
}
