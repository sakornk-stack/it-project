import type { Grade, InstructorStudentEntry } from '@eduanalyze-ai/shared-types';
import {
  ALL,
  DEFAULT_STUDENT_FILTERS,
  NO_STUDENTS_IN_COURSES,
  applyStudentFilters,
  buildStudentsSummary,
  buildYearLevelsFigures,
  countPeople,
  groupByPerson,
  lowGradeIds,
  parseStudentFilters,
  studentFiltersToQuery,
} from './student-directory';

function row(
  id: string,
  course: string,
  grade: Grade,
  name = `นิสิต ${id}`,
): InstructorStudentEntry {
  return {
    studentProfileId: id,
    studentCode: `S${id}`,
    fullName: name,
    courseId: `c-${course}`,
    courseCode: course,
    courseName: `วิชา ${course}`,
    grade,
    // The backend's per-course level is not read here: only the grade is.
    riskLevel: 'NORMAL',
  };
}

// s1 has a C and an F in two courses; s2 has a C only; s3 has an A and a B; s4 a D+.
const entries = [
  row('1', 'CS101', 'C', 'Somchai'),
  row('1', 'CS201', 'F', 'Somchai'),
  row('2', 'CS101', 'C', 'Malee'),
  row('3', 'CS101', 'A', 'Anan'),
  row('3', 'CS301', 'B', 'Anan'),
  row('4', 'CS201', 'D_PLUS', 'Dara'),
];

const params = (query: string) => new URLSearchParams(query);

describe('groupByPerson', () => {
  it('makes one entry per student with the low-grade course first', () => {
    const people = groupByPerson(entries);
    expect(people).toHaveLength(4);
    const s1 = people.find((p) => p.studentProfileId === '1')!;
    expect(s1.hasLowGrade).toBe(true);
    expect(s1.primary.courseCode).toBe('CS201');
    expect(s1.others.map((o) => o.courseCode)).toEqual(['CS101']);
  });

  it('breaks a tie by course code', () => {
    const anan = groupByPerson(entries).find((p) => p.studentProfileId === '3')!;
    expect(anan.primary.courseCode).toBe('CS101');
    expect(anan.others.map((o) => o.courseCode)).toEqual(['CS301']);
  });

  it('a C is not a low grade; D+, D, F and U are; W, I and S are not', () => {
    const has = (grade: Grade) => groupByPerson([row('x', 'CS1', grade)])[0].hasLowGrade;
    expect(['C', 'C_PLUS', 'B', 'A', 'W', 'I', 'S'].map((g) => has(g as Grade))).toEqual(
      Array(7).fill(false),
    );
    expect(['D_PLUS', 'D', 'F', 'U'].map((g) => has(g as Grade))).toEqual(Array(4).fill(true));
  });
});

describe('countPeople', () => {
  it('counts people, never rows, and low is part of total', () => {
    expect(countPeople(groupByPerson(entries))).toEqual({ total: 4, low: 2 });
  });
});

describe('applyStudentFilters', () => {
  it('with no filters lists everyone, low grades first then code', () => {
    const { people, counts } = applyStudentFilters(entries, DEFAULT_STUDENT_FILTERS);
    expect(people.map((p) => p.studentProfileId)).toEqual(['1', '4', '2', '3']);
    expect(counts).toEqual({ total: 4, low: 2 });
  });

  it('filters to the people with a low grade but keeps the counts of everyone', () => {
    const { people, counts } = applyStudentFilters(entries, {
      ...DEFAULT_STUDENT_FILTERS,
      grade: 'LOW',
    });
    expect(people.map((p) => p.studentProfileId)).toEqual(['1', '4']);
    expect(counts).toEqual({ total: 4, low: 2 });
  });

  it('a course filter looks at that course only', () => {
    const { people, counts } = applyStudentFilters(entries, {
      ...DEFAULT_STUDENT_FILTERS,
      courseId: 'c-CS101',
    });
    const s1 = people.find((p) => p.studentProfileId === '1')!;
    expect(s1.hasLowGrade).toBe(false);
    expect(s1.others).toEqual([]);
    expect(counts).toEqual({ total: 3, low: 0 });
  });

  it('a course the instructor does not teach matches nobody', () => {
    const { people, counts } = applyStudentFilters(entries, {
      ...DEFAULT_STUDENT_FILTERS,
      courseId: 'c-OTHER',
    });
    expect(people).toEqual([]);
    expect(counts).toEqual({ total: 0, low: 0 });
  });

  it('searches code and name, case-insensitive and trimmed', () => {
    const byName = applyStudentFilters(entries, { ...DEFAULT_STUDENT_FILTERS, q: '  malee ' });
    expect(byName.people.map((p) => p.studentProfileId)).toEqual(['2']);
    const byCode = applyStudentFilters(entries, { ...DEFAULT_STUDENT_FILTERS, q: 's4' });
    expect(byCode.people.map((p) => p.studentProfileId)).toEqual(['4']);
    expect(byCode.counts).toEqual({ total: 1, low: 1 });
  });

  it('is empty for no rows', () => {
    expect(applyStudentFilters([], DEFAULT_STUDENT_FILTERS)).toEqual({
      people: [],
      counts: { total: 0, low: 0 },
    });
  });
});

describe('parseStudentFilters / studentFiltersToQuery', () => {
  it('reads the grade filter and the other filters', () => {
    expect(parseStudentFilters(params('grade=low'))).toEqual({
      grade: 'LOW',
      courseId: ALL,
      q: '',
    });
    expect(parseStudentFilters(params('grade=low&course=c-CS101&q=S1'))).toEqual({
      grade: 'LOW',
      courseId: 'c-CS101',
      q: 'S1',
    });
  });

  it('falls back to defaults for unknown or empty values, including the old ?risk=', () => {
    expect(parseStudentFilters(params('grade=FOO&course='))).toEqual(DEFAULT_STUDENT_FILTERS);
    expect(parseStudentFilters(params('risk=CRITICAL'))).toEqual(DEFAULT_STUDENT_FILTERS);
    expect(parseStudentFilters(params(''))).toEqual(DEFAULT_STUDENT_FILTERS);
  });

  it('round-trips and leaves defaults out of the URL', () => {
    const filters = { grade: 'LOW' as const, courseId: 'c-CS101', q: 'ma lee' };
    expect(parseStudentFilters(params(studentFiltersToQuery(filters)))).toEqual(filters);
    expect(studentFiltersToQuery(DEFAULT_STUDENT_FILTERS)).toBe('');
    expect(studentFiltersToQuery({ ...DEFAULT_STUDENT_FILTERS, q: '   ' })).toBe('');
  });
});

describe('buildStudentsSummary', () => {
  it('says how many people have a low grade, counted once each', () => {
    expect(buildStudentsSummary(entries, 3)).toBe('นิสิต 4 คนใน 3 วิชา · มีเกรด D+ ลงไป 2 คน');
  });

  it('says so when nobody has one', () => {
    const calm = [row('3', 'CS101', 'C'), row('4', 'CS201', 'A')];
    expect(buildStudentsSummary(calm, 2)).toBe(
      'นิสิต 2 คนใน 2 วิชา · ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
    );
  });

  it('no rows: a notice when there are courses, nothing when there are none', () => {
    expect(buildStudentsSummary([], 2)).toBe(NO_STUDENTS_IN_COURSES);
    expect(buildStudentsSummary([], 0)).toBeNull();
  });

  it('never prints NaN or undefined', () => {
    expect(buildStudentsSummary(entries, 3)).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('lowGradeIds and buildYearLevelsFigures', () => {
  type Track = 'on_track' | 'behind' | null;
  const person = (id: string, onTrackStatus: Track = 'on_track') => ({
    studentProfileId: id,
    onTrackStatus,
  });
  const bucket = (yearLevel: number, ...students: ReturnType<typeof person>[]) => ({
    yearLevel,
    label: yearLevel === 4 ? 'ปี 4 ขึ้นไป' : `ปี ${yearLevel}`,
    students,
  });

  it('lowGradeIds holds each person with a low grade once', () => {
    expect([...lowGradeIds(entries)].sort()).toEqual(['1', '4']);
  });

  it('the figures count everyone, those with a low grade and those behind the plan', () => {
    const buckets = [
      bucket(1, person('1')),
      bucket(2, person('2', 'behind'), person('3'), person('4')),
    ];
    expect(buildYearLevelsFigures(buckets, lowGradeIds(entries))).toEqual({
      total: 4,
      lowGrade: 2,
      behind: 1,
    });
  });

  it('the low-grade figure is unknown (null), not zero, when the students report is unavailable', () => {
    expect(buildYearLevelsFigures([bucket(1, person('a', 'behind'))], null)).toEqual({
      total: 1,
      lowGrade: null,
      behind: 1,
    });
  });

  it('a student with no row in the students report is not counted', () => {
    expect(buildYearLevelsFigures([bucket(1, person('zzz'))], lowGradeIds(entries)).lowGrade).toBe(
      0,
    );
  });

  it('the figure equals the people the students page counts', () => {
    const buckets = [bucket(1, person('1'), person('2'), person('3'), person('4'))];
    const students = applyStudentFilters(entries, DEFAULT_STUDENT_FILTERS).counts;
    expect(buildYearLevelsFigures(buckets, lowGradeIds(entries)).lowGrade).toBe(students.low);
  });

  it('no students: all zero', () => {
    expect(buildYearLevelsFigures([bucket(1), bucket(2)], lowGradeIds(entries))).toEqual({
      total: 0,
      lowGrade: 0,
      behind: 0,
    });
  });
});
