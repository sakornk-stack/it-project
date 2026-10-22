import type { AtRiskStudent, Grade, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import { buildAttentionRows, selectFollowUps } from './instructor-dashboard';

// Made-up courses and people only.
function course(overrides: Partial<InstructorCourseSummary> = {}): InstructorCourseSummary {
  return {
    courseId: 'c1',
    code: 'CS101',
    name: 'วิชาสมมติ ก',
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

function person(id: string, grade: Grade): AtRiskStudent {
  return {
    studentProfileId: id,
    studentCode: `S${id}`,
    fullName: `นิสิต ${id}`,
    grade,
    riskLevel: grade === 'C' ? 'WATCH' : 'CRITICAL',
    academicYear: 2567,
    semesterTerm: 'FIRST',
  };
}

describe('buildAttentionRows', () => {
  it('orders by distance from the bar and reads a status for each course', () => {
    const rows = buildAttentionRows([
      course({ courseId: 'ok', achievementPercent: 80 }),
      course({ courseId: 'near', achievementPercent: 57 }),
      course({ courseId: 'below', achievementPercent: 40 }),
      course({ courseId: 'few', studentCount: 3, achievementPercent: 20 }),
      course({ courseId: 'none', studentCount: 0, achievementPercent: null }),
    ]);
    expect(rows.map((r) => [r.course.courseId, r.status])).toEqual([
      ['below', 'below'],
      ['near', 'near'],
      ['ok', 'met'],
      ['few', 'few'],
      ['none', 'none'],
    ]);
    expect(rows[4].percent).toBeNull();
  });

  it('says how many whole points a course is short of its bar, and its latest term', () => {
    const rows = buildAttentionRows([
      course({
        courseId: 'near',
        achievementPercent: 62,
        achievementThreshold: 70,
        semesterTrend: [
          {
            academicYear: 2569,
            semesterTerm: 'FIRST',
            studentCount: 20,
            gradedCount: 20,
            achievementPercent: 62,
          },
        ],
      }),
      course({ courseId: 'ok', achievementPercent: 80 }),
      course({ courseId: 'few', studentCount: 3, achievementPercent: 20 }),
    ]);
    expect(rows.map((r) => [r.course.courseId, r.shortBy, r.termLabel])).toEqual([
      ['near', 8, 'ภาคต้น / 2569'],
      ['ok', null, null],
      ['few', null, null],
    ]);
  });

  it('counts D+ and below only, and gives the change only when both terms have 5 or more people', () => {
    const [row] = buildAttentionRows([
      course({
        atRiskStudents: [person('1', 'F'), person('2', 'C'), person('3', 'D_PLUS')],
        semesterTrend: [
          {
            academicYear: 2566,
            semesterTerm: 'SECOND',
            studentCount: 20,
            gradedCount: 20,
            achievementPercent: 70,
          },
          {
            academicYear: 2567,
            semesterTerm: 'FIRST',
            studentCount: 20,
            gradedCount: 20,
            achievementPercent: 64,
          },
        ],
      }),
    ]);
    expect(row.lowGrade).toBe(2);
    expect(row.change?.points).toBe(-6);

    const [thin] = buildAttentionRows([
      course({
        semesterTrend: [
          {
            academicYear: 2566,
            semesterTerm: 'SECOND',
            studentCount: 4,
            gradedCount: 4,
            achievementPercent: 70,
          },
          {
            academicYear: 2567,
            semesterTerm: 'FIRST',
            studentCount: 20,
            gradedCount: 20,
            achievementPercent: 64,
          },
        ],
      }),
    ]);
    expect(thin.change).toBeNull();
  });

  it('is empty for no courses', () => {
    expect(buildAttentionRows([])).toEqual([]);
  });
});

describe('selectFollowUps', () => {
  const courses = [
    course({
      courseId: 'a',
      code: 'A1',
      achievementPercent: 80,
      atRiskStudents: [person('1', 'D_PLUS'), person('2', 'C')],
    }),
    course({
      courseId: 'b',
      code: 'B1',
      achievementPercent: 40,
      atRiskStudents: [person('3', 'D'), person('1', 'F'), person('4', 'U')],
    }),
  ];

  it('lists worst grades first, U with F, then the course needing attention first', () => {
    const { rows, total, people } = selectFollowUps(courses);
    expect(rows.map((r) => [r.studentCode, r.grade, r.courseCode])).toEqual([
      ['S1', 'F', 'B1'],
      ['S4', 'U', 'B1'],
      ['S3', 'D', 'B1'],
      ['S1', 'D_PLUS', 'A1'],
    ]);
    expect(total).toBe(4);
    expect(people).toBe(3);
  });

  it('keeps at most `max` rows but counts them all', () => {
    const { rows, total } = selectFollowUps(courses, 2);
    expect(rows).toHaveLength(2);
    expect(total).toBe(4);
  });

  it('is empty when nobody has D+ or below', () => {
    expect(selectFollowUps([course({ atRiskStudents: [person('9', 'C')] })])).toEqual({
      rows: [],
      total: 0,
      people: 0,
    });
  });
});
