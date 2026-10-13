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

describe('buildInstructorSummary', () => {
  it('normal: every course passes and nobody needs following up', () => {
    expect(buildInstructorSummary(allPassing)).toBe(
      'ทุกวิชาผ่านเป้า · ได้ B ขึ้นไปเฉลี่ย 74% (เทอมล่าสุด 50 คน: ▲ ดีขึ้น 10 จุดจากเทอมก่อน) · ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
    );
  });

  it('at risk: follow-ups first, then the worst course, then the average', () => {
    expect(buildInstructorSummary(withRisk)).toBe(
      'มีเกรด D+ ลงไป 2 คน · 1 จาก 2 วิชายังไม่ถึงเป้า เริ่มที่ CS201 โครงสร้างข้อมูล 48% (เป้า 60%) · ได้ B ขึ้นไปเฉลี่ย 62% (เทอมล่าสุด 50 คน: ▼ แย่ลง 12 จุดจากเทอมก่อน)',
    );
  });

  it('no data: courses without students get the existing no-students line', () => {
    expect(buildInstructorSummary([course({ studentCount: 0, achievementPercent: 0 })])).toBe(
      NO_STUDENTS_SUMMARY,
    );
  });

  it('no courses at all returns null', () => {
    expect(buildInstructorSummary([])).toBeNull();
  });

  it('leaves out the arrow when there is only one term', () => {
    expect(buildInstructorSummary([course()])).toBe(
      'ทุกวิชาผ่านเป้า · ได้ B ขึ้นไปเฉลี่ย 80% · ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
    );
  });

  it('says "with students" when some courses are still empty', () => {
    expect(buildInstructorSummary([course(), course({ courseId: 'c2', studentCount: 0 })])).toBe(
      'ทุกวิชาที่มีนิสิตผ่านเป้า · ได้ B ขึ้นไปเฉลี่ย 80% · ยังไม่มีนิสิตที่มีเกรด D+ ลงไป',
    );
  });

  it('never prints NaN or undefined when numbers are broken', () => {
    const broken = [
      course({
        achievementPercent: Number.NaN,
        achievementThreshold: Number.NaN,
        semesterTrend: [term(2566, 'SECOND', 10, Number.NaN), term(2567, 'FIRST', 10, Number.NaN)],
      }),
    ];
    const line = buildInstructorSummary(broken);
    expect(line).toBe('ยังไม่มีนิสิตที่มีเกรด D+ ลงไป');
    expect(line).not.toMatch(/NaN|undefined|Infinity/);
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
});
