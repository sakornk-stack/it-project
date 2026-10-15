import type {
  InstructorCourseTimelineCourse,
  InstructorCourseTimelineSemester,
  InstructorCourseTimelineYear,
} from '@eduanalyze-ai/shared-types';
import { formatSemesterLabel } from './grade-label';
import { SEMESTER_TERM_RANK } from './instructor-summary';

// Pure reading of GET /dashboard/instructor/course-timeline. Enrollment counts
// here are per term and include W/I, so nothing in this file is mixed with the
// dashboard's cumulative achievement figures.

const YEAR_LEVEL_LABELS: Record<number, string> = { 1: 'ปี 1', 2: 'ปี 2', 3: 'ปี 3', 4: 'ปี 4 ขึ้นไป' };

export interface LatestTerm {
  academicYear: number;
  semester: InstructorCourseTimelineSemester;
}

export interface TimelineSplit {
  latest: LatestTerm | null;
  // Every other term, still grouped by year, newest first; years left empty are dropped.
  previousYears: InstructorCourseTimelineYear[];
}

const isCount = (n: number) => Number.isFinite(n) && n > 0;

export function splitTimeline(years: readonly InstructorCourseTimelineYear[]): TimelineSplit {
  let latest: LatestTerm | null = null;
  for (const year of years) {
    for (const semester of year.semesters) {
      if (semester.courses.length === 0 || !(semester.semesterTerm in SEMESTER_TERM_RANK)) continue;
      const newer =
        !latest ||
        year.academicYear > latest.academicYear ||
        (year.academicYear === latest.academicYear &&
          SEMESTER_TERM_RANK[semester.semesterTerm] >
            SEMESTER_TERM_RANK[latest.semester.semesterTerm]);
      if (newer) latest = { academicYear: year.academicYear, semester };
    }
  }
  const previousYears = years
    .map((year) => ({
      ...year,
      semesters: year.semesters.filter(
        (s) => s.courses.length > 0 && s.semesterId !== latest?.semester.semesterId,
      ),
    }))
    .filter((year) => year.semesters.length > 0)
    .sort((a, b) => b.academicYear - a.academicYear);
  return { latest, previousYears };
}

// The year level most of this term's seats sit in; a tie goes to the lower year.
export function predominantYearLevel(
  courses: readonly InstructorCourseTimelineCourse[],
): number | null {
  const seats = new Map<number, number>();
  for (const c of courses) {
    if (!isCount(c.studentCount) || !(c.predominantYearLevel in YEAR_LEVEL_LABELS)) continue;
    seats.set(c.predominantYearLevel, (seats.get(c.predominantYearLevel) ?? 0) + c.studentCount);
  }
  let best: number | null = null;
  for (const [level, count] of [...seats.entries()].sort((a, b) => a[0] - b[0])) {
    if (best === null || count > (seats.get(best) ?? 0)) best = level;
  }
  return best;
}

export function yearLevelLabel(level: number): string {
  return YEAR_LEVEL_LABELS[level] ?? `ปี ${level}`;
}

export function termLabel(latest: LatestTerm): string {
  return formatSemesterLabel(latest.semester.semesterTerm, latest.academicYear);
}

export function countCourses(years: readonly InstructorCourseTimelineYear[]) {
  const semesters = years.reduce((sum, y) => sum + y.semesters.length, 0);
  const courses = years.reduce(
    (sum, y) => sum + y.semesters.reduce((s, sem) => s + sem.courses.length, 0),
    0,
  );
  return { courses, semesters };
}

// Header line for /instructor/my-courses. null = no teaching history at all.
export function buildTimelineSummary(
  years: readonly InstructorCourseTimelineYear[],
): string | null {
  const { latest } = splitTimeline(years);
  if (!latest) return null;
  const { courses } = latest.semester;
  const parts = [`${termLabel(latest)}: สอน ${courses.length} วิชา`];
  const seats = courses.reduce((sum, c) => sum + (isCount(c.studentCount) ? c.studentCount : 0), 0);
  if (seats > 0) {
    // One course: seats are people. Several: a student in two of them counts twice here.
    parts.push(courses.length > 1 ? `การลงทะเบียน ${seats} รายการ (นับต่อวิชา)` : `นิสิต ${seats} คน`);
  }
  const level = predominantYearLevel(courses);
  if (level !== null) parts.push(`ส่วนใหญ่${yearLevelLabel(level)}`);
  return parts.join(' · ');
}
