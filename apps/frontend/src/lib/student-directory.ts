import type { InstructorStudentEntry } from '@eduanalyze-ai/shared-types';
import { LOW_GRADE_LABEL, NO_LOW_GRADE, isLowGrade } from './low-grade';

// Pure helpers for /instructor/students. They only regroup the rows
// GET /dashboard/instructor/students already returned (one row per student ×
// course, grade = the latest attempt of that course), so they cannot widen the
// instructor's scope. "Has a low grade" means the latest result of at least one
// of the instructor's courses is D+, D, F or U (see low-grade.ts).

export const ALL = 'ALL';
export type GradeFilter = typeof ALL | 'LOW';

export interface StudentFilters {
  grade: GradeFilter;
  courseId: string;
  q: string;
}

export const DEFAULT_STUDENT_FILTERS: StudentFilters = { grade: ALL, courseId: ALL, q: '' };

// One card per person. `primary` is the course to show first: a low grade
// before any other, then course code. `others` are the rest in the same order.
export interface StudentPerson {
  studentProfileId: string;
  studentCode: string;
  fullName: string;
  hasLowGrade: boolean;
  primary: InstructorStudentEntry;
  others: InstructorStudentEntry[];
}

// `low` is a part of `total`: the two always add up with the people who do not.
export interface PersonCounts {
  total: number;
  low: number;
}

const byLowThenCourse = (a: InstructorStudentEntry, b: InstructorStudentEntry) =>
  Number(isLowGrade(b.grade)) - Number(isLowGrade(a.grade)) ||
  a.courseCode.localeCompare(b.courseCode);

export function groupByPerson(entries: readonly InstructorStudentEntry[]): StudentPerson[] {
  const rowsById = new Map<string, InstructorStudentEntry[]>();
  for (const entry of entries) {
    const rows = rowsById.get(entry.studentProfileId) ?? [];
    rows.push(entry);
    rowsById.set(entry.studentProfileId, rows);
  }
  return [...rowsById.values()].map((rows) => {
    const [primary, ...others] = [...rows].sort(byLowThenCourse);
    return {
      studentProfileId: primary.studentProfileId,
      studentCode: primary.studentCode,
      fullName: primary.fullName,
      hasLowGrade: isLowGrade(primary.grade),
      primary,
      others,
    };
  });
}

// People with a low grade first, then student code.
export function sortPeople(people: readonly StudentPerson[]): StudentPerson[] {
  return [...people].sort(
    (a, b) =>
      Number(b.hasLowGrade) - Number(a.hasLowGrade) || a.studentCode.localeCompare(b.studentCode),
  );
}

export function countPeople(people: readonly Pick<StudentPerson, 'hasLowGrade'>[]): PersonCounts {
  return { total: people.length, low: people.filter((p) => p.hasLowGrade).length };
}

const matchesQuery = (person: StudentPerson, q: string) => {
  const term = q.trim().toLowerCase();
  if (term === '') return true;
  return (
    person.studentCode.toLowerCase().includes(term) || person.fullName.toLowerCase().includes(term)
  );
};

// Course and search narrow the people first; `counts` is taken at that point so
// the filter button shows how many people it would leave. The grade filter then
// keeps the people with a low grade within the remaining courses.
export function applyStudentFilters(
  entries: readonly InstructorStudentEntry[],
  filters: StudentFilters,
): { people: StudentPerson[]; counts: PersonCounts } {
  const inCourse =
    filters.courseId === ALL ? entries : entries.filter((e) => e.courseId === filters.courseId);
  const narrowed = groupByPerson(inCourse).filter((p) => matchesQuery(p, filters.q));
  const counts = countPeople(narrowed);
  const people = filters.grade === ALL ? narrowed : narrowed.filter((p) => p.hasLowGrade);
  return { people: sortPeople(people), counts };
}

// Anything unknown falls back to the default, so a stale or hand-edited URL
// never leaves the page in a state the controls cannot show. A course the
// instructor does not teach simply matches no rows.
export function parseStudentFilters(params: { get(name: string): string | null }): StudentFilters {
  return {
    grade: params.get('grade') === 'low' ? 'LOW' : ALL,
    courseId: params.get('course')?.trim() || ALL,
    q: params.get('q') ?? '',
  };
}

// Default values are left out so the plain page keeps a clean URL.
export function studentFiltersToQuery(filters: StudentFilters): string {
  const params = new URLSearchParams();
  if (filters.grade !== ALL) params.set('grade', 'low');
  if (filters.courseId !== ALL) params.set('course', filters.courseId);
  if (filters.q.trim() !== '') params.set('q', filters.q.trim());
  return params.toString();
}

export const NO_STUDENTS_IN_COURSES = 'ยังไม่มีนิสิตในรายวิชาที่คุณสอน';

// Header line, people not rows, from the unfiltered list. null = nothing to say
// (no data loaded yet or no courses at all).
export function buildStudentsSummary(
  entries: readonly InstructorStudentEntry[],
  courseCount: number,
): string | null {
  if (entries.length === 0) return courseCount > 0 ? NO_STUDENTS_IN_COURSES : null;
  const counts = countPeople(groupByPerson(entries));
  const courses = new Set(entries.map((e) => e.courseId)).size;
  const population = `นิสิต ${counts.total} คนใน ${courses} วิชา`;
  return counts.low === 0
    ? `${population} · ${NO_LOW_GRADE}`
    : `${population} · ${LOW_GRADE_LABEL} ${counts.low} คน`;
}

// ---- /instructor/year-levels ----

// The students with a low grade in at least one of the instructor's courses,
// by studentProfileId. A student with no row in the students report is not in
// it (unknown, so not counted).
export function lowGradeIds(entries: readonly InstructorStudentEntry[]): Set<string> {
  return new Set(entries.filter((e) => isLowGrade(e.grade)).map((e) => e.studentProfileId));
}

interface YearLevelBucketLike {
  yearLevel: number;
  label: string;
  students: readonly { studentProfileId: string; onTrackStatus: 'on_track' | 'behind' | null }[];
}

export interface YearLevelsFigures {
  total: number;
  // null when the students report is unavailable: unknown, not zero.
  lowGrade: number | null;
  behind: number;
}

// The three figures at the top of /instructor/year-levels.
export function buildYearLevelsFigures(
  buckets: readonly YearLevelBucketLike[],
  lowIds: ReadonlySet<string> | null,
): YearLevelsFigures {
  const students = buckets.flatMap((b) => b.students);
  return {
    total: students.length,
    lowGrade: lowIds ? students.filter((s) => lowIds.has(s.studentProfileId)).length : null,
    behind: students.filter((s) => s.onTrackStatus === 'behind').length,
  };
}
