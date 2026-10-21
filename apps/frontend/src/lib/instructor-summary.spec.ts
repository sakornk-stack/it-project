import type {
  AtRiskStudent,
  InstructorCourseSummary,
  SemesterAchievement,
  SemesterTerm,
} from '@eduanalyze-ai/shared-types';
import { countLowGradePeople } from './follow-ups';
import {
  NO_STUDENTS_SUMMARY,
  buildInstructorSummary,
  computeAchievementChange,
  formatAchievementChange,
  overallAchievementPercent,
  sortCoursesByAttention,
} from './instructor-summary';

function course(overrides: Partial<InstructorCourseSummary> = {}): InstructorCourseSummary {
  return {
    courseId: 'c1',
    code: 'CS101',
    name: 'Programming',
    studentCount: 40,
    atRiskStudents: [],
    achievementPercent: 80,
    achievementThreshold: 60,
    gradeDistribution: {} as InstructorCourseSummary['gradeDistribution'],
    clos: [],
    plos: [],
    courseAssessment: { courseId: 'c1', submissionCount: 0, clos: [] },
    semesterTrend: [],
    ...overrides,
  };
}

function atRisk(id: string, riskLevel: 'CRITICAL' | 'WATCH'): AtRiskStudent {
  return {
    studentProfileId: id,
    studentCode: id,
    fullName: id,
    grade: riskLevel === 'CRITICAL' ? 'F' : 'C',
    riskLevel,
    academicYear: 2567,
    semesterTerm: 'FIRST',
  };
}

function term(
  academicYear: number,
  semesterTerm: SemesterTerm,
  studentCount: number,
  achievementPercent: number,
): SemesterAchievement {
  return {
    academicYear,
    semesterTerm,
    studentCount,
    gradedCount: studentCount,
    achievementPercent,
  };
}

const allPassing = [
  course({
    semesterTrend: [term(2566, 'SECOND', 20, 70), term(2567, 'FIRST', 20, 80)],
  }),
  course({
    courseId: 'c2',
    code: 'CS102',
    name: 'Discrete Math',
    studentCount: 60,
    achievementPercent: 70,
    semesterTrend: [term(2566, 'SECOND', 30, 60), term(2567, 'FIRST', 30, 70)],
  }),
];

const withRisk = [
  course({ atRiskStudents: [atRisk('s1', 'CRITICAL'), atRisk('s2', 'WATCH')] }),
  course({
    courseId: 'c2',
    code: 'CS201',
    name: 'โครงสร้างข้อมูล',
    studentCount: 50,
    achievementPercent: 48,
    atRiskStudents: [atRisk('s1', 'WATCH'), atRisk('s3', 'CRITICAL'), atRisk('s4', 'WATCH')],
    semesterTrend: [term(2566, 'SECOND', 50, 60), term(2567, 'FIRST', 50, 48)],
  }),
];

describe('countLowGradePeople', () => {
  it('counts a student with a low grade in two courses once, and leaves out C', () => {
    // s1 F (and a C elsewhere), s3 F; s2 and s4 only have a C.
    expect(countLowGradePeople(withRisk)).toBe(2);
  });

  it('D+, D, F and U count; C does not', () => {
    const only = (grade: AtRiskStudent['grade']) =>
      countLowGradePeople([course({ atRiskStudents: [{ ...atRisk('s', 'WATCH'), grade }] })]);
    expect(['D_PLUS', 'D', 'F', 'U'].map((g) => only(g as AtRiskStudent['grade']))).toEqual([
      1, 1, 1, 1,
    ]);
    expect(only('C')).toBe(0);
  });

  it('is zero when nobody has a low grade', () => {
    expect(countLowGradePeople([course()])).toBe(0);
  });
});

describe('overallAchievementPercent', () => {
  it('weights each course by its student count', () => {
    expect(overallAchievementPercent(allPassing)).toBeCloseTo(74, 10);
  });

  it('skips courses with no students or a non-finite percent, and is null when none count', () => {
    expect(overallAchievementPercent([course({ studentCount: 0 })])).toBeNull();
    expect(
      overallAchievementPercent([
        course(),
        course({ courseId: 'c2', achievementPercent: Number.NaN }),
      ]),
    ).toBe(80);
  });
});

describe('computeAchievementChange', () => {
  it('pools every course per term and compares the latest term with the one before', () => {
    // 2566/2: (14 + 18) / 50 = 64%; 2567/1: (16 + 21) / 50 = 74%
    expect(computeAchievementChange(allPassing)).toEqual({
      direction: 'up',
      delta: expect.closeTo(10, 10),
      latestStudentCount: 50,
    });
  });

  it('reports a drop', () => {
    expect(computeAchievementChange(withRisk)).toEqual({
      direction: 'down',
      delta: expect.closeTo(-12, 10),
      latestStudentCount: 50,
    });
  });

  it('merges courses whose terms do not line up', () => {
    const courses = [
      course({ semesterTrend: [term(2566, 'SECOND', 10, 50), term(2567, 'FIRST', 10, 60)] }),
      course({ courseId: 'c2', semesterTrend: [term(2567, 'FIRST', 30, 80)] }),
    ];
    // 2566/2: 5/10 = 50%; 2567/1: (6 + 24) / 40 = 75%
    expect(computeAchievementChange(courses)).toEqual({
      direction: 'up',
      delta: expect.closeTo(25, 10),
      latestStudentCount: 40,
    });
  });

  it('orders SUMMER after SECOND in the same year', () => {
    const courses = [
      course({ semesterTrend: [term(2567, 'SUMMER', 10, 90), term(2567, 'SECOND', 10, 50)] }),
    ];
    expect(computeAchievementChange(courses)).toEqual({
      direction: 'up',
      delta: expect.closeTo(40, 10),
      latestStudentCount: 10,
    });
  });

  it('is flat below half a point', () => {
    const courses = [
      course({ semesterTrend: [term(2566, 'SECOND', 1000, 70), term(2567, 'FIRST', 1000, 70.4)] }),
    ];
    expect(computeAchievementChange(courses)).toEqual({
      direction: 'flat',
      delta: 0,
      latestStudentCount: 1000,
    });
  });

  it('pools by gradedCount (the percent base), not studentCount, so S/U students do not skew it', () => {
    // Each point: 10 enrolled, of whom only 4 have a letter grade (the rest S/U).
    // 2566/2: 50% of 4 = 2; 2567/1: 75% of 4 = 3 -> pooled with c2's 20/20 graded at 50%.
    const withSu = (year: number, termName: SemesterTerm, percent: number) => ({
      ...term(year, termName, 10, percent),
      gradedCount: 4,
    });
    const courses = [
      course({ semesterTrend: [withSu(2566, 'SECOND', 50), withSu(2567, 'FIRST', 75)] }),
      course({ courseId: 'c2', semesterTrend: [term(2567, 'FIRST', 20, 50)] }),
    ];
    // 2566/2: 2/4 = 50%; 2567/1: (3 + 10) / 24 = 54.17%
    expect(computeAchievementChange(courses)).toEqual({
      direction: 'up',
      delta: expect.closeTo(54.1667 - 50, 3),
      latestStudentCount: 24,
    });
  });

  it('is null with fewer than two terms, ignoring empty or non-finite points', () => {
    expect(
      computeAchievementChange([course({ semesterTrend: [term(2567, 'FIRST', 10, 80)] })]),
    ).toBeNull();
    expect(
      computeAchievementChange([
        course({
          semesterTrend: [
            term(2566, 'FIRST', 0, 50),
            term(2566, 'SECOND', 10, Number.NaN),
            term(2567, 'FIRST', 10, 80),
          ],
        }),
      ]),
    ).toBeNull();
    expect(computeAchievementChange([])).toBeNull();
  });
});

describe('formatAchievementChange', () => {
  it('uses arrows and whole points, signed only when asked, with the latest term head count', () => {
    expect(
      formatAchievementChange(
        { direction: 'up', delta: 4.4, latestStudentCount: 38 },
        { signed: true },
      ),
    ).toBe('เทอมล่าสุด 38 คน: ▲ ดีขึ้น +4 จุดจากเทอมก่อน');
    expect(
      formatAchievementChange(
        { direction: 'down', delta: -5.6, latestStudentCount: 12 },
        { signed: true },
      ),
    ).toBe('เทอมล่าสุด 12 คน: ▼ แย่ลง −6 จุดจากเทอมก่อน');
    expect(
      formatAchievementChange(
        { direction: 'up', delta: 100, latestStudentCount: 2 },
        { signed: false },
      ),
    ).toBe('เทอมล่าสุด 2 คน (ข้อมูลน้อย): ▲ ดีขึ้น 100 จุดจากเทอมก่อน');
    expect(
      formatAchievementChange(
        { direction: 'flat', delta: 0, latestStudentCount: 40 },
        { signed: true },
      ),
    ).toBe('– เทอมล่าสุด 40 คน: เท่ากับเทอมก่อน');
  });
});

describe('null achievementPercent (no graded student)', () => {
  it('is not averaged in as 0 and does not trigger a below-target warning', () => {
    const nullCourse = course({
      courseId: 'c2',
      studentCount: 5,
      achievementPercent: null,
    });
    expect(overallAchievementPercent([course(), nullCourse])).toBe(80);
    expect(buildInstructorSummary([course(), nullCourse])!.join(' ')).not.toMatch(
      /ยังไม่ถึงเกณฑ์|NaN/,
    );
  });

  it('sorts a null course after measured ones', () => {
    const input = [
      course({ courseId: 'none', achievementPercent: null }),
      course({ courseId: 'low', achievementPercent: 20 }),
    ];
    expect(sortCoursesByAttention(input).map((c) => c.courseId)).toEqual(['low', 'none']);
  });
});

describe('buildInstructorSummary', () => {
  it('normal: every course passes and nobody needs following up', () => {
    expect(buildInstructorSummary(allPassing)).toEqual([
      'ทุกวิชาถึงเกณฑ์',
      'ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
      'รวมทุกวิชาได้ B ขึ้นไป 74% · เทอมล่าสุด 50 คน: ▲ ดีขึ้น 10 จุดจากเทอมก่อน',
    ]);
  });

  it('at risk: the course furthest below its bar, the people with a low grade, then the pooled share', () => {
    expect(buildInstructorSummary(withRisk)).toEqual([
      '1 จาก 2 วิชายังไม่ถึงเกณฑ์ เริ่มที่ CS201 โครงสร้างข้อมูล 48% (เกณฑ์ 60%)',
      'นิสิต 2 คนได้ D+ ลงไป ใน 2 วิชา',
      'รวมทุกวิชาได้ B ขึ้นไป 62% · เทอมล่าสุด 50 คน: ▼ แย่ลง 12 จุดจากเทอมก่อน',
    ]);
  });

  it('starts with the course furthest from its own bar, not the lowest percentage', () => {
    const lines = buildInstructorSummary([
      course({
        courseId: 'a',
        code: 'A1',
        name: 'ก',
        achievementPercent: 50,
        achievementThreshold: 55,
      }),
      course({
        courseId: 'b',
        code: 'B1',
        name: 'ข',
        achievementPercent: 65,
        achievementThreshold: 80,
      }),
    ]);
    expect(lines?.[0]).toBe('2 จาก 2 วิชายังไม่ถึงเกณฑ์ เริ่มที่ B1 ข 65% (เกณฑ์ 80%)');
  });

  it('writes an unchanged term without a stray dash after the separator', () => {
    const flat = [
      course({ semesterTrend: [term(2566, 'SECOND', 20, 80), term(2567, 'FIRST', 20, 80)] }),
    ];
    expect(buildInstructorSummary(flat)?.[2]).toBe(
      'รวมทุกวิชาได้ B ขึ้นไป 80% · เทอมล่าสุด 20 คน: เท่ากับเทอมก่อน',
    );
  });

  it('no data: courses without students get the existing no-students line', () => {
    expect(buildInstructorSummary([course({ studentCount: 0, achievementPercent: 0 })])).toEqual([
      NO_STUDENTS_SUMMARY,
    ]);
  });

  it('no courses at all returns null', () => {
    expect(buildInstructorSummary([])).toBeNull();
  });

  it('leaves out the change when there is only one term', () => {
    expect(buildInstructorSummary([course()])).toEqual([
      'ทุกวิชาถึงเกณฑ์',
      'ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
      'รวมทุกวิชาได้ B ขึ้นไป 80%',
    ]);
  });

  it('counts only the courses it can judge when some are empty or too small', () => {
    const expected = 'ทุกวิชาที่มีนิสิตพอจะสรุปได้ถึงเกณฑ์ (1 จาก 2 วิชา)';
    expect(
      buildInstructorSummary([course(), course({ courseId: 'c2', studentCount: 0 })])?.[0],
    ).toBe(expected);
    expect(
      buildInstructorSummary([
        course(),
        course({ courseId: 'c2', studentCount: 3, achievementPercent: 10 }),
      ])?.[0],
    ).toBe(expected);
  });

  it('gives no verdict when every course has fewer than 5 graded people', () => {
    expect(buildInstructorSummary([course({ studentCount: 3, achievementPercent: 30 })])).toEqual([
      'ยังสรุปเทียบเกณฑ์ไม่ได้ เพราะทุกวิชามีนิสิตที่ได้เกรดไม่ถึง 5 คน',
      'ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
      'รวมทุกวิชาได้ B ขึ้นไป 30%',
    ]);
  });

  it('never prints NaN or undefined when numbers are broken', () => {
    const broken = [
      course({
        achievementPercent: Number.NaN,
        achievementThreshold: Number.NaN,
        semesterTrend: [term(2566, 'SECOND', 10, Number.NaN), term(2567, 'FIRST', 10, Number.NaN)],
      }),
    ];
    const lines = buildInstructorSummary(broken);
    expect(lines).toEqual(['ยังไม่มีนิสิตที่มีเกรด D+ ลงไป']);
    expect(lines!.join(' ')).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('sortCoursesByAttention', () => {
  it('puts the lowest achievement first and courses without students last, without mutating the input', () => {
    const input = [
      course({ courseId: 'empty', studentCount: 0, achievementPercent: 0 }),
      course({ courseId: 'high', achievementPercent: 90 }),
      course({ courseId: 'broken', achievementPercent: Number.NaN }),
      course({ courseId: 'low', achievementPercent: 20 }),
    ];
    expect(sortCoursesByAttention(input).map((c) => c.courseId)).toEqual([
      'low',
      'high',
      'empty',
      'broken',
    ]);
    expect(input.map((c) => c.courseId)).toEqual(['empty', 'high', 'broken', 'low']);
  });

  it('ranks by distance from each course bar, with too-small courses after the judged ones', () => {
    const input = [
      course({ courseId: 'few', studentCount: 3, achievementPercent: 0 }),
      course({ courseId: 'near', achievementPercent: 50, achievementThreshold: 55 }),
      course({ courseId: 'far', achievementPercent: 65, achievementThreshold: 80 }),
      course({ courseId: 'none', achievementPercent: null }),
    ];
    expect(sortCoursesByAttention(input).map((c) => c.courseId)).toEqual([
      'far',
      'near',
      'few',
      'none',
    ]);
  });
});
