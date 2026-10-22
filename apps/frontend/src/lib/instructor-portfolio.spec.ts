import type {
  AtRiskStudent,
  Grade,
  InstructorCourseSummary,
  SemesterAchievement,
} from '@eduanalyze-ai/shared-types';
import {
  buildHeadline,
  buildPooledTrend,
  buildPortfolio,
  countCoursesAtBar,
  pooledChange,
} from './instructor-portfolio';

// Made-up courses and people only.
function course(overrides: Partial<InstructorCourseSummary> = {}): InstructorCourseSummary {
  return {
    courseId: 'c1',
    code: 'CS101',
    name: 'วิชาสมมติ ก',
    studentCount: 40,
    atRiskStudents: [],
    achievementPercent: 80,
    achievementThreshold: 70,
    gradeDistribution: {} as InstructorCourseSummary['gradeDistribution'],
    clos: [],
    plos: [],
    courseAssessment: { courseId: 'c1', submissionCount: 0, clos: [] },
    semesterTrend: [],
    ...overrides,
  };
}

const dist = (d: Partial<Record<Grade, number>>) =>
  d as InstructorCourseSummary['gradeDistribution'];

const point = (
  academicYear: number,
  semesterTerm: SemesterAchievement['semesterTerm'],
  gradedCount: number,
  achievementPercent: number,
): SemesterAchievement => ({
  academicYear,
  semesterTerm,
  studentCount: gradedCount,
  gradedCount,
  achievementPercent,
});

function person(id: string, grade: Grade): AtRiskStudent {
  return {
    studentProfileId: id,
    studentCode: `S${id}`,
    fullName: `นิสิต ${id}`,
    grade,
    riskLevel: 'CRITICAL',
    academicYear: 2567,
    semesterTerm: 'FIRST',
  };
}

describe('buildPortfolio', () => {
  it('adds the A to F tallies of every course and takes B or above from them', () => {
    const p = buildPortfolio([
      course({
        courseId: 'a',
        gradeDistribution: dist({ A: 4, B: 2, C: 2, F: 2, W: 9, I: 1, S: 3 }),
      }),
      course({ courseId: 'b', gradeDistribution: dist({ B_PLUS: 3, D: 1 }) }),
    ]);
    expect(p.graded).toBe(14);
    expect(p.achieved).toBe(9);
    expect(p.percent).toBeCloseTo((9 / 14) * 100);
    expect(p.bars.map((b) => [b.grade, b.count])).toEqual([
      ['A', 4],
      ['B_PLUS', 3],
      ['B', 2],
      ['C_PLUS', 0],
      ['C', 2],
      ['D_PLUS', 0],
      ['D', 1],
      ['F', 2],
    ]);
  });

  it('weights the bar by people and says when the courses do not share one', () => {
    const same = buildPortfolio([
      course({ gradeDistribution: dist({ A: 10 }) }),
      course({ courseId: 'b', gradeDistribution: dist({ A: 10 }) }),
    ]);
    expect(same.target).toBe(70);
    expect(same.barsDiffer).toBe(false);
    const differ = buildPortfolio([
      course({ achievementThreshold: 60, gradeDistribution: dist({ A: 10 }) }),
      course({ courseId: 'b', achievementThreshold: 80, gradeDistribution: dist({ A: 30 }) }),
    ]);
    expect(differ.target).toBe(75);
    expect(differ.barsDiffer).toBe(true);
  });

  it('gives a status only with 5 or more graded people', () => {
    expect(buildPortfolio([course({ gradeDistribution: dist({ A: 2, F: 2 }) })]).status).toBe(
      'few',
    );
    expect(buildPortfolio([course({ gradeDistribution: dist({ A: 3, F: 7 }) })]).status).toBe(
      'below',
    );
    expect(buildPortfolio([course({ gradeDistribution: dist({ A: 8, F: 2 }) })]).status).toBe(
      'met',
    );
  });

  it('has no percent without a letter grade, and no course is not a crash', () => {
    const none = buildPortfolio([course({ gradeDistribution: dist({ W: 4 }) })]);
    expect(none.percent).toBeNull();
    expect(none.status).toBe('none');
    expect(buildPortfolio([]).graded).toBe(0);
  });
});

describe('buildPooledTrend and pooledChange', () => {
  it('pools the same term across courses by head count and orders terms oldest first', () => {
    const terms = buildPooledTrend([
      course({
        semesterTrend: [point(2568, 'SECOND', 10, 50), point(2568, 'FIRST', 20, 50)],
      }),
      course({ courseId: 'b', semesterTrend: [point(2568, 'FIRST', 20, 100)] }),
    ]);
    expect(terms.map((t) => [t.key, t.graded, t.achieved])).toEqual([
      ['2568-FIRST', 40, 30],
      ['2568-SECOND', 10, 5],
    ]);
    expect(terms[0].percent).toBe(75);
  });

  it('gives the change in whole points only when both terms have 5 or more graded people', () => {
    const base = [point(2568, 'FIRST', 20, 64), point(2568, 'SECOND', 20, 69)];
    expect(pooledChange(buildPooledTrend([course({ semesterTrend: base })]))?.points).toBe(5);
    const thin = [point(2568, 'FIRST', 4, 64), point(2568, 'SECOND', 20, 69)];
    expect(pooledChange(buildPooledTrend([course({ semesterTrend: thin })]))).toBeNull();
    expect(pooledChange(buildPooledTrend([course({ semesterTrend: [base[0]] })]))).toBeNull();
    expect(pooledChange([])).toBeNull();
  });
});

describe('buildHeadline', () => {
  it('names the short courses, where to start and the low-grade people in amber', () => {
    const h = buildHeadline([
      course({
        courseId: 'a',
        code: 'A1',
        achievementPercent: 62,
        atRiskStudents: [person('1', 'F')],
      }),
      course({
        courseId: 'b',
        code: 'B1',
        achievementPercent: 63,
        atRiskStudents: [person('2', 'D')],
      }),
      course({ courseId: 'c', code: 'C1', achievementPercent: 74 }),
    ])!;
    expect(h.tone).toBe('warning');
    expect(h.lead).toBe('2 จาก 3 วิชายังไม่ถึงเกณฑ์ 70%');
    expect(h.rest).toBe(
      ' เริ่มดูที่ A1 (62%) และ B1 (63%) · มีนิสิต 2 คนที่ได้ D+ ลงไป ใน 2 วิชา ควรติดตาม',
    );
  });

  it('is calm when every course is at its bar', () => {
    const h = buildHeadline([course(), course({ courseId: 'b' })])!;
    expect(h.tone).toBe('success');
    expect(h.lead).toBe('ทุกวิชาถึงเกณฑ์');
    expect(h.rest).toContain('ยังไม่มีนิสิตที่มีเกรด D+ ลงไป');
  });

  it('says so when no course has enough people, has no students, or no course', () => {
    const few = buildHeadline([course({ studentCount: 3 })])!;
    expect(few.tone).toBe('neutral');
    expect(few.lead).toContain('ไม่ถึง 5 คน');
    expect(buildHeadline([course({ studentCount: 0, achievementPercent: null })])!.tone).toBe(
      'neutral',
    );
    expect(buildHeadline([])).toBeNull();
  });

  it('works for one course', () => {
    const h = buildHeadline([course({ achievementPercent: 50 })])!;
    expect(h.lead).toBe('1 จาก 1 วิชายังไม่ถึงเกณฑ์ 70%');
  });
});

describe('countCoursesAtBar', () => {
  it('counts the courses at their own bar out of those that can be judged', () => {
    expect(
      countCoursesAtBar([
        course({ achievementPercent: 80 }),
        course({ courseId: 'b', achievementPercent: 50 }),
        course({ courseId: 'c', studentCount: 2 }),
      ]),
    ).toEqual({ met: 1, judged: 2 });
  });
});
