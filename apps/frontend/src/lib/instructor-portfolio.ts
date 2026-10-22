import type { Grade, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { countLowGradePeople } from './follow-ups';
import { GRADE_ORDER, INSUFFICIENT_BELOW, type TrendChange } from './course-snapshot';
import { formatSemesterLabel } from './grade-label';
import { ACHIEVED_GRADES, statusOf, type OverviewStatus } from './instructor-overview';
import {
  NO_STUDENTS_SUMMARY,
  SEMESTER_TERM_RANK,
  hasVerdict,
  sortCoursesByAttention,
} from './instructor-summary';
import { NO_LOW_GRADE, isLowGrade } from './low-grade';

// Every course the instructor teaches read as one: the figures of the dashboard's
// stat cards, the grade distribution, the term trend and the headline. Pure; it
// only regroups GET /dashboard/instructor, so it stays inside "courses I teach".
// The base is people with a letter grade (A to F), the same base the backend uses
// for a course's share at B or above. A student in two courses counts once per
// course: the dashboard has no id to join them on.

const num = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface GradeBar {
  grade: Grade;
  count: number;
}

export interface Portfolio {
  courseCount: number;
  // People with a letter grade, counted per course.
  graded: number;
  achieved: number;
  // null = nobody has a letter grade yet.
  percent: number | null;
  bars: GradeBar[];
  // The courses' bars weighted by how many people they grade; null = none known.
  target: number | null;
  // True when the courses do not share one bar, so `target` is an average of them.
  barsDiffer: boolean;
  // 'few' = graded, but under INSUFFICIENT_BELOW people: no verdict, like a course page.
  status: OverviewStatus | 'few';
}

export function buildPortfolio(courses: readonly InstructorCourseSummary[]): Portfolio {
  const bars: GradeBar[] = GRADE_ORDER.map((grade) => ({
    grade,
    count: courses.reduce(
      (sum, c) => sum + (num(c.gradeDistribution?.[grade]) ? c.gradeDistribution[grade] : 0),
      0,
    ),
  }));
  const graded = bars.reduce((sum, b) => sum + b.count, 0);
  const achieved = bars.reduce((sum, b) => (ACHIEVED_GRADES.has(b.grade) ? sum + b.count : sum), 0);
  const percent = graded > 0 ? (achieved / graded) * 100 : null;

  let weight = 0;
  let sum = 0;
  const bar = new Set<number>();
  for (const c of courses) {
    const n = GRADE_ORDER.reduce((s, g) => s + (c.gradeDistribution?.[g] ?? 0), 0);
    if (n > 0 && num(c.achievementThreshold)) {
      weight += n;
      sum += c.achievementThreshold * n;
      bar.add(c.achievementThreshold);
    }
  }
  const target = weight > 0 ? sum / weight : null;

  let status: Portfolio['status'] = 'none';
  if (percent !== null) status = graded < INSUFFICIENT_BELOW ? 'few' : statusOf(percent, target);
  return {
    courseCount: courses.length,
    graded,
    achieved,
    percent,
    bars,
    target,
    barsDiffer: bar.size > 1,
    status,
  };
}

// ---- terms, pooled over the courses ----

export interface PooledTerm {
  key: string;
  label: string;
  graded: number;
  achieved: number;
  percent: number;
}

// Each semesterTrend point is (B or above / gradedCount) for one course in one
// term, so percent x gradedCount recovers the head count and the pooled figure is
// a true share, not an average of averages. Oldest term first.
export function buildPooledTrend(courses: readonly InstructorCourseSummary[]): PooledTerm[] {
  const byTerm = new Map<
    string,
    {
      year: number;
      term: InstructorCourseSummary['semesterTrend'][number]['semesterTerm'];
      graded: number;
      achieved: number;
    }
  >();
  for (const course of courses) {
    for (const p of course.semesterTrend) {
      if (
        !(p.gradedCount > 0) ||
        !num(p.achievementPercent) ||
        !(p.semesterTerm in SEMESTER_TERM_RANK)
      )
        continue;
      const key = `${p.academicYear}-${p.semesterTerm}`;
      const t = byTerm.get(key) ?? {
        year: p.academicYear,
        term: p.semesterTerm,
        graded: 0,
        achieved: 0,
      };
      t.graded += p.gradedCount;
      t.achieved += Math.round((p.achievementPercent * p.gradedCount) / 100);
      byTerm.set(key, t);
    }
  }
  return [...byTerm.entries()]
    .sort(
      ([, a], [, b]) => a.year - b.year || SEMESTER_TERM_RANK[a.term] - SEMESTER_TERM_RANK[b.term],
    )
    .map(([key, t]) => ({
      key,
      label: formatSemesterLabel(t.term, t.year),
      graded: t.graded,
      achieved: t.achieved,
      percent: (t.achieved / t.graded) * 100,
    }));
}

// The latest term against the one before it, only when both have enough people.
export function pooledChange(terms: readonly PooledTerm[]): TrendChange | null {
  const last = terms[terms.length - 1];
  const before = terms[terms.length - 2];
  if (!last || !before || last.graded < INSUFFICIENT_BELOW || before.graded < INSUFFICIENT_BELOW)
    return null;
  return {
    points: Math.round(last.percent) - Math.round(before.percent),
    fromLabel: before.label,
    toLabel: last.label,
  };
}

// ---- headline ----

export type HeadlineTone = 'warning' | 'success' | 'neutral';

export interface Headline {
  tone: HeadlineTone;
  // The bold first clause, then the rest of the sentence.
  lead: string;
  rest: string;
}

const pct = (n: number) => `${Math.round(n)}%`;

// One short sentence: how many courses are short of their bar and where to start,
// then how many people have D+ or below. Amber while a course is short, calm when
// none is; never red. null = no courses.
export function buildHeadline(courses: readonly InstructorCourseSummary[]): Headline | null {
  if (courses.length === 0) return null;
  if (!courses.some((c) => num(c.studentCount) && c.studentCount > 0)) {
    return { tone: 'neutral', lead: NO_STUDENTS_SUMMARY, rest: '' };
  }
  const judged = courses.filter(hasVerdict);
  const below = sortCoursesByAttention(
    judged.filter((c) => c.achievementPercent < c.achievementThreshold),
  );
  const lowPeople = countLowGradePeople(courses);
  const lowCourses = courses.filter((c) =>
    c.atRiskStudents.some((s) => isLowGrade(s.grade)),
  ).length;
  const lowText =
    lowPeople > 0
      ? `มีนิสิต ${lowPeople} คนที่ได้ D+ ลงไป${lowCourses > 1 ? ` ใน ${lowCourses} วิชา` : ''} ควรติดตาม`
      : NO_LOW_GRADE;

  if (below.length > 0) {
    const bars = new Set(below.map((c) => c.achievementThreshold));
    const barText = bars.size === 1 ? ` ${below[0].achievementThreshold}%` : '';
    const first = below
      .slice(0, 2)
      .map((c) => `${c.code} (${pct(c.achievementPercent)})`)
      .join(' และ ');
    return {
      tone: 'warning',
      lead: `${below.length} จาก ${judged.length} วิชายังไม่ถึงเกณฑ์${barText}`,
      rest: ` เริ่มดูที่ ${first} · ${lowText}`,
    };
  }
  if (judged.length > 0) {
    return {
      tone: 'success',
      lead:
        judged.length < courses.length
          ? `ทุกวิชาที่มีนิสิตพอจะสรุปได้ถึงเกณฑ์ (${judged.length} จาก ${courses.length} วิชา)`
          : 'ทุกวิชาถึงเกณฑ์',
      rest: ` · ${lowText}`,
    };
  }
  return {
    tone: 'neutral',
    lead: `ยังสรุปเทียบเกณฑ์ไม่ได้ เพราะแต่ละวิชามีนิสิตที่ได้เกรดไม่ถึง ${INSUFFICIENT_BELOW} คน`,
    rest: ` · ${lowText}`,
  };
}

// Courses at or above their own bar, out of those with enough people to judge.
export function countCoursesAtBar(courses: readonly InstructorCourseSummary[]): {
  met: number;
  judged: number;
} {
  const judged = courses.filter(hasVerdict);
  return {
    met: judged.filter((c) => c.achievementPercent >= c.achievementThreshold).length,
    judged: judged.length,
  };
}
