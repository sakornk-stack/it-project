import type {
  Grade,
  InstructorCourseSummary,
  InstructorCourseTimelineYear,
} from '@eduanalyze-ai/shared-types';
import {
  buildCourseSnapshot,
  changeLine,
  courseTermInfo,
  dataLevelOf,
  formatPointsChange,
  gradedPeopleLine,
  summaryLine,
} from './course-snapshot';
import { emptyCounts, summarizeParts } from './instructor-overview';

const counts = (c: Partial<Record<Grade, number>>) => ({ ...emptyCounts(), ...c });

function course(
  dist: Partial<Record<Grade, number>>,
  overrides: Partial<InstructorCourseSummary> = {},
): InstructorCourseSummary {
  return {
    courseId: 'c1',
    code: '02739111',
    name: 'วิชาตัวอย่าง',
    studentCount: 0,
    atRiskStudents: [],
    achievementPercent: 0,
    achievementThreshold: 70,
    gradeDistribution: counts(dist),
    clos: [],
    plos: [],
    courseAssessment: { courseId: 'c1', submissionCount: 0, clos: [] },
    semesterTrend: [],
    ...overrides,
  };
}

const seat = (id: string, grade: Grade) => ({ studentProfileId: id, courseId: 'c1', grade });

describe('dataLevelOf', () => {
  it('splits at 5 and 10 people', () => {
    expect(dataLevelOf(0)).toBe('insufficient');
    expect(dataLevelOf(4)).toBe('insufficient');
    expect(dataLevelOf(5)).toBe('low');
    expect(dataLevelOf(9)).toBe('low');
    expect(dataLevelOf(10)).toBe('ok');
    expect(dataLevelOf(Number.NaN)).toBe('insufficient');
  });
});

describe('sample size counts only A to F', () => {
  it('3 people with A to F and 10 withdrawn is still "too few"', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 1, B: 1, C: 1, W: 10 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.stats.graded).toBe(3);
    expect(s.stats.lowSample).toBe(true);
    expect(s.level).toBe('insufficient');
    expect(s.goals.sparse).toBe(true);
  });

  it('S and U do not make up the numbers either', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 2, B: 2, S: 6, U: 2 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.stats.counted).toBe(12);
    expect(s.stats.graded).toBe(4);
    expect(s.level).toBe('insufficient');
  });

  it('the term comparison needs 5 or more A-to-F people on both terms, whatever the head count', () => {
    const point = (term: 'FIRST' | 'SECOND', year: number, graded: number, pct: number) => ({
      academicYear: year,
      semesterTerm: term,
      studentCount: 30,
      gradedCount: graded,
      achievementPercent: pct,
    });
    const s = buildCourseSnapshot({
      course: course(
        { A: 8 },
        {
          semesterTrend: [
            point('FIRST', 2566, 20, 50),
            point('SECOND', 2566, 3, 90),
            point('FIRST', 2567, 12, 60),
            point('SECOND', 2567, 12, 70),
          ],
        },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.trend.terms.map((t) => t.level)).toEqual(['ok', 'insufficient', 'ok', 'ok']);
    expect(s.trend.terms.map((t) => t.delta)).toEqual([null, null, null, 10]);
  });
});

describe('buildCourseSnapshot', () => {
  it('flags a course with no grade as empty', () => {
    const s = buildCourseSnapshot({
      course: course({}),
      seatRows: [],
      yearLevelByStudent: new Map(),
    });
    expect(s.empty).toBe(true);
  });

  it('reads the share and level of a normal course, with no goal or status in it', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 6, B: 4, C: 2, F: 1, W: 1 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.stats.seats).toBe(14);
    expect(s.stats.counted).toBe(13);
    expect(s.stats.achievedPercent).toBeCloseTo((10 / 13) * 100);
    expect(s.level).toBe('ok');
    expect(s).not.toHaveProperty('status');
    expect(s).not.toHaveProperty('target');
    expect(s.years).toBeNull();
  });

  it('hides the numbers for year levels under 5 people', () => {
    const rows = [
      ...['a', 'b', 'c', 'd'].map((id) => seat(id, 'A')),
      ...['e', 'f', 'g', 'h', 'i', 'j'].map((id) => seat(id, 'B')),
    ];
    const level = new Map<string, number>([
      ...['a', 'b', 'c', 'd'].map((id) => [id, 1] as [string, number]),
      ...['e', 'f', 'g', 'h', 'i', 'j'].map((id) => [id, 2] as [string, number]),
    ]);
    const s = buildCourseSnapshot({
      course: course({ A: 4, B: 6 }),
      seatRows: rows,
      yearLevelByStudent: level,
    });
    const [y1, y2] = s.years!.rows;
    expect(y1).toMatchObject({ yearLevel: 1, level: 'insufficient', showNumbers: false });
    expect(y2).toMatchObject({ yearLevel: 2, level: 'low', showNumbers: true });
    expect(y2).not.toHaveProperty('status');
    expect(s.years!.unplaced).toBe(0);
  });

  it('counts seats with no year level as unplaced', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 2 }),
      seatRows: [seat('a', 'A'), seat('b', 'A')],
      yearLevelByStudent: new Map([['a', 1]]),
    });
    expect(s.years!.unplaced).toBe(1);
  });

  it('lists the goals in code order and judges none of them', () => {
    const clos = [
      { cloId: 'k2', code: 'CLO2', description: 'สอง', threshold: 70, isAchieved: false },
      { cloId: 'k10', code: 'CLO10', description: 'สิบ', threshold: 70, isAchieved: true },
      { cloId: 'k1', code: 'CLO1', description: 'หนึ่ง', threshold: 70, isAchieved: true },
    ];
    const few = buildCourseSnapshot({
      course: course({ A: 3 }, { clos }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(few.goals.sparse).toBe(true);
    expect(few.goals.items.map((g) => g.code)).toEqual(['CLO1', 'CLO2', 'CLO10']);
    const enough = buildCourseSnapshot({
      course: course({ A: 8 }, { clos }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(enough.goals.sparse).toBe(false);
    for (const g of enough.goals.items) {
      expect(g).not.toHaveProperty('state');
      expect(Object.keys(g).sort()).toEqual(['cloId', 'code', 'description']);
    }
  });

  it('shares the A to F row out of 100 and counts F, W, I, S/U on their own', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 2, B: 2, F: 1, W: 2, I: 1, S: 1, U: 1 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.grades.scored).toBe(5);
    expect(s.grades.segments.reduce((sum, g) => sum + g.percent, 0)).toBeCloseTo(100);
    expect(s.grades).toMatchObject({ f: 1, w: 2, incomplete: 1, notGraded: 2 });
  });

  it('needs 3 terms for a trend, and no change when a term is too small', () => {
    const point = (term: 'FIRST' | 'SECOND', year: number, n: number, pct: number) => ({
      academicYear: year,
      semesterTerm: term,
      studentCount: n,
      gradedCount: n,
      achievementPercent: pct,
    });
    const two = buildCourseSnapshot({
      course: course(
        { A: 8 },
        { semesterTrend: [point('FIRST', 2567, 20, 60), point('SECOND', 2567, 20, 70)] },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(two.trend.enough).toBe(false);
    const three = buildCourseSnapshot({
      course: course(
        { A: 8 },
        {
          semesterTrend: [
            point('FIRST', 2566, 20, 50),
            point('FIRST', 2567, 20, 60),
            point('SECOND', 2567, 20, 72),
          ],
        },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(three.trend.enough).toBe(true);
    expect(three.trend.terms.map((t) => t.isLatest)).toEqual([false, false, true]);
    expect(three.trend.change?.points).toBe(12);
    const tiny = buildCourseSnapshot({
      course: course(
        { A: 8 },
        {
          semesterTrend: [
            point('FIRST', 2566, 20, 50),
            point('FIRST', 2567, 20, 60),
            point('SECOND', 2567, 3, 100),
          ],
        },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(tiny.trend.terms[2].showNumbers).toBe(false);
    expect(tiny.trend.change).toBeNull();
  });

  it('compares each term with the one before only when both have 5 or more people', () => {
    const point = (term: 'FIRST' | 'SECOND', year: number, n: number, pct: number) => ({
      academicYear: year,
      semesterTerm: term,
      studentCount: n,
      gradedCount: n,
      achievementPercent: pct,
    });
    const s = buildCourseSnapshot({
      course: course(
        { A: 8 },
        {
          semesterTrend: [
            point('FIRST', 2566, 20, 50.4),
            point('SECOND', 2566, 20, 60.4),
            point('FIRST', 2567, 4, 90),
            point('SECOND', 2567, 12, 56),
            point('FIRST', 2568, 12, 56.3),
          ],
        },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    // no term before the first; 5 people or more on both sides; 4 people on one side
    expect(s.trend.terms.map((t) => t.delta)).toEqual([null, 10, null, null, 0]);
  });

  it('has no comparison for a trend with no head count', () => {
    const s = buildCourseSnapshot({
      course: course(
        { A: 8 },
        {
          semesterTrend: [
            {
              academicYear: 2566,
              semesterTerm: 'FIRST',
              studentCount: Number.NaN,
              gradedCount: Number.NaN,
              achievementPercent: 50,
            },
            {
              academicYear: 2566,
              semesterTerm: 'SECOND',
              studentCount: Number.NaN,
              gradedCount: Number.NaN,
              achievementPercent: 60,
            },
          ],
        },
      ),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(s.trend.terms.every((t) => t.delta === null)).toBe(true);
  });
});

describe('courseTermInfo', () => {
  const years: InstructorCourseTimelineYear[] = [
    {
      academicYear: 2567,
      semesters: [
        {
          semesterId: 's1',
          semesterTerm: 'SECOND',
          courses: [
            {
              courseId: 'c1',
              code: 'x',
              name: 'x',
              programCode: 'CS',
              curriculumYear: 2565,
              studentCount: 5,
              gradedCount: 5,
              totalStudentCount: 0,
              predominantYearLevel: 2,
            },
          ],
        },
        {
          semesterId: 's0',
          semesterTerm: 'FIRST',
          courses: [
            {
              courseId: 'c1',
              code: 'x',
              name: 'x',
              programCode: 'CS',
              curriculumYear: 2560,
              studentCount: 5,
              gradedCount: 5,
              totalStudentCount: 0,
              predominantYearLevel: 2,
            },
          ],
        },
      ],
    },
  ];

  it('uses the latest term the course appears in', () => {
    expect(courseTermInfo(years, 'c1')).toEqual({
      termLabel: 'ภาคปลาย / 2567',
      curriculum: 'หลักสูตร CS ปี 2565',
    });
  });

  it('is null for a course that was never taught', () => {
    expect(courseTermInfo(years, 'other')).toBeNull();
  });
});

describe('words', () => {
  it('says "from the data we have" and never claims more', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 8, F: 2 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(summaryLine(s)).toBe('จากข้อมูลที่มี 80% ได้ B ขึ้นไป');
    expect(gradedPeopleLine(s.stats)).toBe('จากนิสิตที่มีเกรด 10 คน');
    expect(changeLine({ points: -4, fromLabel: 'ภาคต้น / 2567', toLabel: 'x' })).toBe(
      'จากข้อมูลที่มี ลดลง 4 จุด เมื่อเทียบภาคต้น / 2567',
    );
    expect(changeLine({ points: 0, fromLabel: 'ก', toLabel: 'ข' })).toContain('ใกล้เคียงเดิม');
  });

  it('keeps W and I out of the sentence base and says so', () => {
    const s = buildCourseSnapshot({
      course: course({ A: 8, W: 2, I: 1 }),
      seatRows: [],
      yearLevelByStudent: null,
    });
    expect(gradedPeopleLine(s.stats)).toBe(
      'จากนิสิตที่มีเกรด 11 คน (ไม่รวมถอนหรือยังไม่สมบูรณ์ 3 คน ในร้อยละ B ขึ้นไป)',
    );
  });
});

describe('formatPointsChange', () => {
  it('signs a change and keeps zero plain', () => {
    expect(formatPointsChange(4)).toBe('+4');
    expect(formatPointsChange(-3)).toBe('−3');
    expect(formatPointsChange(0)).toBe('0');
  });
});
