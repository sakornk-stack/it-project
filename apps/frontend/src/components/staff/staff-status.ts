import type { StaffStudentRiskEntry } from '@eduanalyze-ai/shared-types';
import { INSUFFICIENT_BELOW } from '@/lib/course-snapshot';
import { readStudentRisk, type StaffRiskKey } from './student-reading';

// The numbers every Staff page shows about students, derived in one place from
// the one list (GET /dashboard/staff/students) so the pages cannot disagree.
// No GPA cut-off lives here: the band comes from the backend's gpaRiskLevel()
// (cumulative GPA), and "no data" is the absence of a GPA.

export type StaffStatusKey = StaffRiskKey | 'SUSPENDED';

export const SUSPENDED_LABEL = 'ระงับ';

// The one wording of each status's rule, shared by every page that explains it.
export const STATUS_RULES: Record<ActiveStatusKey, string> = {
  CRITICAL: 'GPA สะสมต่ำกว่า 1.50',
  WATCH: 'GPA สะสม 1.50–1.74',
  NORMAL: 'GPA สะสม 1.75 ขึ้นไป',
  NO_DATA: 'ยังไม่มี GPA (ไม่นับเกรด W I S U)',
};

// Most urgent first; suspended last because those students are not counted.
export const STATUS_ORDER: StaffStatusKey[] = [
  'CRITICAL',
  'WATCH',
  'NORMAL',
  'NO_DATA',
  'SUSPENDED',
];

type StatusInput = Pick<
  StaffStudentRiskEntry,
  'isActive' | 'riskLevel' | 'gpa'
>;

export function staffStatus(student: StatusInput): StaffStatusKey {
  if (!student.isActive) return 'SUSPENDED';
  return readStudentRisk(student).key;
}

export type ActiveStatusKey = Exclude<StaffStatusKey, 'SUSPENDED'>;

export interface StudentSummary {
  active: number;
  suspended: number;
  // Always sums to `active`: every active student has exactly one status.
  byStatus: Record<ActiveStatusKey, number>;
  // Active students that have a GPA — everyone except NO_DATA.
  withRecords: number;
  // The people an average GPA is taken over; equal to withRecords now that
  // "no data" means "no GPA".
  withGpa: number;
  averageGpa: number | null;
}

export function summarizeStudents(students: readonly StatusInput[]): StudentSummary {
  const byStatus: Record<ActiveStatusKey, number> = {
    CRITICAL: 0,
    WATCH: 0,
    NORMAL: 0,
    NO_DATA: 0,
  };
  let suspended = 0;
  let gpaSum = 0;
  let withGpa = 0;
  for (const student of students) {
    const status = staffStatus(student);
    if (status === 'SUSPENDED') {
      suspended += 1;
      continue;
    }
    byStatus[status] += 1;
    if (student.gpa !== null) {
      gpaSum += student.gpa;
      withGpa += 1;
    }
  }
  const active = byStatus.CRITICAL + byStatus.WATCH + byStatus.NORMAL + byStatus.NO_DATA;
  return {
    active,
    suspended,
    byStatus,
    withRecords: active - byStatus.NO_DATA,
    withGpa,
    averageGpa: withGpa > 0 ? gpaSum / withGpa : null,
  };
}

export interface GroupGpaReading {
  kind: 'ok' | 'few' | 'none';
  // The number to show, only when the group is large enough to say anything.
  value: string | null;
  note: string;
}

// An average over a group, never over one person. Under INSUFFICIENT_BELOW
// people it moves too much with a single student, the same bar the
// instructor pages use, so no number is given.
export function readGroupGpa(average: number | null, withGpa: number): GroupGpaReading {
  if (average === null || withGpa === 0) {
    return { kind: 'none', value: null, note: 'ยังไม่มีข้อมูล' };
  }
  if (withGpa < INSUFFICIENT_BELOW) {
    return { kind: 'few', value: null, note: `ข้อมูลยังน้อย (มี GPA ${withGpa} คน)` };
  }
  return { kind: 'ok', value: average.toFixed(2), note: `เฉลี่ยจาก ${withGpa} คนที่มี GPA` };
}

export interface StaffStudentRow extends StaffStudentRiskEntry {
  status: StaffStatusKey;
  // null for suspended students: the year-level report lists active ones only.
  yearLevel: number | null;
}

export function toRows(
  students: readonly StaffStudentRiskEntry[],
  yearLevelById: ReadonlyMap<string, number>,
): StaffStudentRow[] {
  return students.map((student) => ({
    ...student,
    status: staffStatus(student),
    yearLevel: student.isActive ? (yearLevelById.get(student.studentProfileId) ?? null) : null,
  }));
}

export type SortKey = 'severity' | 'code' | 'year' | 'gpa';

export const SORT_LABELS: Record<SortKey, string> = {
  severity: 'ความรุนแรง',
  code: 'รหัสนิสิต',
  year: 'ชั้นปี',
  gpa: 'GPA (น้อยไปมาก)',
};

const byCode = (a: StaffStudentRow, b: StaffStudentRow) =>
  a.studentCode.localeCompare(b.studentCode);
// Missing values go last whichever way the rest is ordered.
const byNullable = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b;

export function sortRows(rows: readonly StaffStudentRow[], key: SortKey): StaffStudentRow[] {
  const compare: Record<SortKey, (a: StaffStudentRow, b: StaffStudentRow) => number> = {
    severity: (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    code: () => 0,
    year: (a, b) => byNullable(a.yearLevel, b.yearLevel),
    gpa: (a, b) => byNullable(a.gpa, b.gpa),
  };
  return [...rows].sort((a, b) => compare[key](a, b) || byCode(a, b));
}

export interface YearRow {
  yearLevel: number;
  summary: StudentSummary;
  behind: number;
}

// One row per year level, built from the same active students the other
// summaries use. `behind` counts the report's on-track flag (null = no flag).
export function summarizeByYearLevel(
  rows: readonly StaffStudentRow[],
  behindById: ReadonlySet<string>,
  yearLevels: readonly number[],
): YearRow[] {
  return yearLevels.map((yearLevel) => {
    const inYear = rows.filter((row) => row.isActive && row.yearLevel === yearLevel);
    return {
      yearLevel,
      summary: summarizeStudents(inYear),
      behind: inYear.filter((row) => behindById.has(row.studentProfileId)).length,
    };
  });
}

// Active courses of the given curricula with nobody assigned. `courses` is
// GET /courses (active only) and `assignments` GET /course-instructors, one
// request each for the whole page, never one per course.
export function coursesWithoutInstructor<C extends { id: string; curriculumId: string }>(
  courses: readonly C[],
  assignments: readonly { courseId: string }[],
  curriculumIds: ReadonlySet<string>,
): C[] {
  const assigned = new Set(assignments.map((assignment) => assignment.courseId));
  return courses.filter(
    (course) => curriculumIds.has(course.curriculumId) && !assigned.has(course.id),
  );
}

// A share of the active students, one decimal. Zero people gives zero, not NaN.
export function sharePercent(count: number, total: number): string {
  return total === 0 ? '0.0%' : `${((count / total) * 100).toFixed(1)}%`;
}
