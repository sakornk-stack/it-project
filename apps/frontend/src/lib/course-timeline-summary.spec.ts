import type {
  InstructorCourseTimelineCourse,
  InstructorCourseTimelineYear,
  SemesterTerm,
} from '@eduanalyze-ai/shared-types';
import {
  buildTimelineSummary,
  countCourses,
  coursesWithoutRecords,
  predominantYearLevel,
  splitTimeline,
} from './course-timeline-summary';

function course(
  id: string,
  studentCount: number,
  predominantYearLevel = 2,
): InstructorCourseTimelineCourse {
  return { courseId: id, code: id, name: id, programCode: 'P', curriculumYear: 2565, studentCount, gradedCount: studentCount, totalStudentCount: studentCount, predominantYearLevel };
}
const sem = (term: SemesterTerm, ...courses: InstructorCourseTimelineCourse[]) => ({
  semesterId: `s-${term}-${courses.map((c) => c.courseId).join('')}`,
  semesterTerm: term,
  courses,
});
const year = (academicYear: number, ...semesters: ReturnType<typeof sem>[]): InstructorCourseTimelineYear => ({
  academicYear,
  semesters,
});

const years = [
  year(2567, sem('FIRST', course('A', 30, 1)), sem('SECOND', course('B', 20, 1))),
  year(2568, sem('FIRST', course('C', 5, 2), course('D', 7, 2), course('E', 3, 3))),
];

describe('splitTimeline', () => {
  it('takes the newest term as latest and keeps the rest by year, newest first', () => {
    const { latest, previousYears } = splitTimeline(years);
    expect(latest?.academicYear).toBe(2568);
    expect(latest?.semester.courses.map((c) => c.courseId)).toEqual(['C', 'D', 'E']);
    expect(previousYears.map((y) => y.academicYear)).toEqual([2567]);
    expect(countCourses(previousYears)).toEqual({ courses: 2, semesters: 2 });
  });

  it('puts SUMMER after SECOND in the same year and keeps earlier terms of that year as previous', () => {
    const { latest, previousYears } = splitTimeline([
      year(2568, sem('SUMMER', course('S', 4)), sem('SECOND', course('B', 9)), sem('FIRST', course('A', 9))),
    ]);
    expect(latest?.semester.semesterTerm).toBe('SUMMER');
    expect(previousYears[0].semesters.map((s) => s.semesterTerm)).toEqual(['SECOND', 'FIRST']);
  });

  it('ignores empty terms and returns no latest for no history', () => {
    expect(splitTimeline([year(2568, sem('FIRST'))])).toEqual({ latest: null, previousYears: [] });
    expect(splitTimeline([])).toEqual({ latest: null, previousYears: [] });
  });
});

describe('predominantYearLevel', () => {
  it('weights by seats, tie goes to the lower year, ignores broken rows', () => {
    expect(predominantYearLevel([course('a', 5, 2), course('b', 7, 2), course('c', 3, 3)])).toBe(2);
    expect(predominantYearLevel([course('a', 5, 3), course('b', 5, 2)])).toBe(2);
    expect(predominantYearLevel([course('a', 0, 2), course('b', Number.NaN, 3)])).toBeNull();
    expect(predominantYearLevel([])).toBeNull();
  });
});

describe('buildTimelineSummary', () => {
  it('normal: latest term, course count, seats and year level', () => {
    expect(buildTimelineSummary(years)).toBe(
      'ภาคต้น / 2568: สอน 3 วิชา · การลงทะเบียน 15 รายการ (นับต่อวิชา) · ส่วนใหญ่ปี 2',
    );
  });

  it('a term with no enrolment leaves the seats and year parts out', () => {
    expect(buildTimelineSummary([year(2568, sem('FIRST', course('A', 0)))])).toBe(
      'ภาคต้น / 2568: สอน 1 วิชา',
    );
  });

  it('no data: null, and never NaN or undefined', () => {
    expect(buildTimelineSummary([])).toBeNull();
    const odd = buildTimelineSummary([year(2568, sem('FIRST', course('A', Number.NaN, 9)))]);
    expect(odd).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('coursesWithoutRecords', () => {
  it('keeps only assigned courses no term of the timeline lists', () => {
    const assigned = [{ courseId: 'A' }, { courseId: 'Z' }, { courseId: 'E' }, { courseId: 'Y' }];
    expect(coursesWithoutRecords(assigned, years)).toEqual([{ courseId: 'Z' }, { courseId: 'Y' }]);
  });

  it('returns every assigned course when the timeline is empty', () => {
    expect(coursesWithoutRecords([{ courseId: 'A' }], [])).toEqual([{ courseId: 'A' }]);
  });
});
