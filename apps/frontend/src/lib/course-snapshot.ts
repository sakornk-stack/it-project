import type {
  Grade,
  InstructorCourseSummary,
  InstructorCourseTimelineYear,
  SemesterAchievement,
} from '@eduanalyze-ai/shared-types';
import { formatPercent } from './format-percent';
import { formatSemesterLabel } from './grade-label';
import {
  INSUFFICIENT_BELOW,
  LOW_SAMPLE_BELOW,
  breakdownByYearLevel,
  buildCourseOverviews,
  type GroupStats,
  type SeatRow,
} from './instructor-overview';
import { SEMESTER_TERM_RANK } from './instructor-summary';

// One reading of one course, shared by the dashboard and the course page so the
// two can never disagree. Pure: it only regroups what the backend returned. It
// has no count of enrolled students (every source lists graded records only),
// so how much to trust a number is judged by how many people have a grade.

// Fewer graded people than this and no verdict is given at all (defined beside
// LOW_SAMPLE_BELOW so the dashboard summary can share it without an import cycle).
export { INSUFFICIENT_BELOW };
// A trend over fewer terms than this is two dots and a line: not a trend.
export const MIN_TERMS_FOR_TREND = 3;

export type DataLevel = 'insufficient' | 'low' | 'ok';

// Judged on the people with a grade from A to F (GroupStats.graded): W, I, S and
// U are not people "with a grade" here, however many there are.
// LOW_SAMPLE_BELOW is the same constant the other instructor pages use.
export function dataLevelOf(graded: number): DataLevel {
  if (!(graded >= INSUFFICIENT_BELOW)) return 'insufficient';
  return graded < LOW_SAMPLE_BELOW ? 'low' : 'ok';
}

// ---- header: which term and curriculum this course was last taught in ----

export interface CourseTermInfo {
  termLabel: string;
  curriculum: string;
}

export function courseTermInfo(
  years: readonly InstructorCourseTimelineYear[],
  courseId: string,
): CourseTermInfo | null {
  let best: { year: number; rank: number; info: CourseTermInfo } | null = null;
  for (const year of years) {
    for (const semester of year.semesters) {
      const rank = SEMESTER_TERM_RANK[semester.semesterTerm];
      const hit = semester.courses.find((c) => c.courseId === courseId);
      if (!hit || rank === undefined) continue;
      if (
        best &&
        (year.academicYear < best.year || (year.academicYear === best.year && rank <= best.rank))
      )
        continue;
      best = {
        year: year.academicYear,
        rank,
        info: {
          termLabel: formatSemesterLabel(semester.semesterTerm, year.academicYear),
          curriculum: hit.programCode ? `หลักสูตร ${hit.programCode} ปี ${hit.curriculumYear}` : '',
        },
      };
    }
  }
  return best?.info ?? null;
}

// ---- the snapshot ----

export interface YearRow {
  yearLevel: number;
  stats: GroupStats;
  level: DataLevel;
  // false = the percentage and grade average are hidden ("—").
  showNumbers: boolean;
}

export interface GoalItem {
  cloId: string;
  code: string;
  description: string;
}

export const GRADE_ORDER: readonly Grade[] = [
  'A',
  'B_PLUS',
  'B',
  'C_PLUS',
  'C',
  'D_PLUS',
  'D',
  'F',
];

export interface GradeSegment {
  grade: Grade;
  count: number;
  // Share of the A to F grades, so the row adds up to 100.
  percent: number;
}

export interface TrendTerm {
  key: string;
  label: string;
  students: number;
  // People with a grade from A to F that term: what level and delta are judged on.
  graded: number;
  percent: number;
  level: DataLevel;
  showNumbers: boolean;
  isLatest: boolean;
  // Points of "B or above" against the term before it, only when both terms
  // have 5 or more graded people; null otherwise.
  delta: number | null;
}

export interface TrendChange {
  points: number;
  fromLabel: string;
  toLabel: string;
}

export interface CourseSnapshot {
  courseId: string;
  stats: GroupStats;
  level: DataLevel;
  // No grade has been recorded for this course at all.
  empty: boolean;
  // null = year levels could not be loaded.
  years: { rows: YearRow[]; unplaced: number } | null;
  goals: { items: GoalItem[]; sparse: boolean };
  grades: {
    segments: GradeSegment[];
    scored: number;
    f: number;
    w: number;
    incomplete: number;
    notGraded: number;
  };
  trend: { termCount: number; enough: boolean; terms: TrendTerm[]; change: TrendChange | null };
}

// One point per term, oldest first, with the change against the term before it
// when both have enough people. Shared with the dashboard's per-course change.
export function buildTrendTerms(points: readonly SemesterAchievement[]): TrendTerm[] {
  const terms: TrendTerm[] = points.map((p, i) => {
    const termLevel = dataLevelOf(p.gradedCount);
    return {
      key: `${p.academicYear}-${p.semesterTerm}`,
      label: formatSemesterLabel(p.semesterTerm, p.academicYear),
      students: p.studentCount,
      graded: p.gradedCount,
      percent: p.achievementPercent,
      level: termLevel,
      showNumbers: termLevel !== 'insufficient',
      isLatest: i === points.length - 1,
      delta: null,
    };
  });
  terms.forEach((term, i) => {
    const previous = terms[i - 1];
    if (previous && term.showNumbers && previous.showNumbers) {
      term.delta = Math.round(term.percent) - Math.round(previous.percent);
    }
  });
  return terms;
}

// The latest term against the one before it; null unless both have enough people.
export function trendChangeOf(terms: readonly TrendTerm[]): TrendChange | null {
  const last = terms[terms.length - 1];
  const before = terms[terms.length - 2];
  return last && before && last.showNumbers && before.showNumbers
    ? {
        points: Math.round(last.percent) - Math.round(before.percent),
        fromLabel: before.label,
        toLabel: last.label,
      }
    : null;
}

export function buildCourseSnapshot({
  course,
  seatRows,
  yearLevelByStudent,
}: {
  course: InstructorCourseSummary;
  // This course's rows from GET /dashboard/instructor/students.
  seatRows: readonly SeatRow[];
  yearLevelByStudent: ReadonlyMap<string, number> | null;
}): CourseSnapshot {
  const { stats } = buildCourseOverviews([course])[0];
  const level = dataLevelOf(stats.graded);

  let years: CourseSnapshot['years'] = null;
  if (yearLevelByStudent) {
    const split = breakdownByYearLevel(seatRows, yearLevelByStudent);
    years = {
      unplaced: split.unplaced,
      rows: (split.byCourse.get(course.courseId) ?? []).map((cell) => {
        const cellLevel = dataLevelOf(cell.stats.graded);
        return {
          yearLevel: cell.yearLevel,
          stats: cell.stats,
          level: cellLevel,
          showNumbers: cellLevel !== 'insufficient',
        };
      }),
    };
  }

  // The backend has one share per course, so a goal has no percentage of its own
  // and none is judged: the goals are listed in code order, and `sparse` says
  // when there are too few people to read anything from the course share.
  const sparse = level === 'insufficient';
  const items: GoalItem[] = [...course.clos]
    .sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true }))
    .map((clo) => ({ cloId: clo.cloId, code: clo.code, description: clo.description }));

  const scored = GRADE_ORDER.reduce((sum, g) => sum + stats.counts[g], 0);
  const segments = GRADE_ORDER.map((grade) => ({
    grade,
    count: stats.counts[grade],
    percent: scored > 0 ? (stats.counts[grade] / scored) * 100 : 0,
  }));

  const terms = buildTrendTerms(course.semesterTrend);
  const change = trendChangeOf(terms);

  return {
    courseId: course.courseId,
    stats,
    level,
    empty: stats.seats === 0,
    years,
    goals: { items, sparse },
    grades: {
      segments,
      scored,
      f: stats.counts.F,
      w: stats.counts.W,
      incomplete: stats.counts.I,
      notGraded: stats.counts.S + stats.counts.U,
    },
    trend: {
      termCount: terms.length,
      enough: terms.length >= MIN_TERMS_FOR_TREND,
      terms,
      change,
    },
  };
}

// ---- words ----

// One word for "too few people to trust the figure" on every instructor page,
// with the head count whenever it is known.
export const SPARSE_LABEL = 'นิสิตน้อย';
export const fewStudentsLabel = (people: number) => `${SPARSE_LABEL} (${people} คน)`;
export const SPARSE_SUMMARY = 'นิสิตน้อย — สรุปได้เบื้องต้น';
export const SPARSE_TREND = 'นิสิตน้อย — ยังไม่ควรสรุปแนวโน้ม';
export const EMPTY_SNAPSHOT = 'ยังไม่มีเกรดที่กรอก — เมื่อมีข้อมูล ระบบจะแสดงภาพรวมที่นี่';
export const DATA_SOURCE_NOTE = 'ข้อมูลล่าสุดจากเกรดที่บันทึกในระบบ';
export const SPARSE_YEAR_NOTE =
  'ชั้นปีที่มีนิสิตที่ได้เกรดไม่ถึง 5 คน ไม่แสดงตัวเลข เพราะเปลี่ยนมากเมื่อเพิ่มหรือลดหนึ่งคน';

// "B or above" as a plain share of the people counted; no goal beside it.
export function summaryLine(snapshot: Pick<CourseSnapshot, 'stats'>): string {
  const { stats } = snapshot;
  if (stats.achievedPercent === null) return SPARSE_SUMMARY;
  return `จากข้อมูลที่มี ${formatPercent(stats.achievedPercent)} ได้ B ขึ้นไป`;
}

// "+4", "−3", "0": a change in points, never coloured as good or bad.
export function formatPointsChange(points: number): string {
  if (points === 0) return '0';
  return `${points > 0 ? '+' : '−'}${Math.abs(points)}`;
}

// People with a grade, and how many of them W and I leave out of the B-or-above share.
export function gradedPeopleParts(stats: GroupStats): { people: number; excluded: number } {
  return { people: stats.seats, excluded: stats.seats - stats.counted };
}

export function excludedNote(excluded: number): string | null {
  return excluded > 0 ? `ไม่รวมถอนหรือยังไม่สมบูรณ์ ${excluded} คน ในร้อยละ B ขึ้นไป` : null;
}

export function gradedPeopleLine(stats: GroupStats): string {
  const { people, excluded } = gradedPeopleParts(stats);
  const note = excludedNote(excluded);
  return `จากนิสิตที่มีเกรด ${people} คน${note ? ` (${note})` : ''}`;
}

export function changeLine(change: TrendChange): string {
  const { points, fromLabel } = change;
  const move =
    points === 0 ? 'ใกล้เคียงเดิม' : `${points > 0 ? 'เพิ่มขึ้น' : 'ลดลง'} ${Math.abs(points)} จุด`;
  return `จากข้อมูลที่มี ${move} เมื่อเทียบ${fromLabel}`;
}
