import type { Grade, InstructorCourseSummary } from '@eduanalyze-ai/shared-types';
import {
  ACHIEVED_GRADES,
  GRADE_POINTS,
  breakdownByYearLevel,
  buildCourseOverviews,
  buildCourseYearMatrix,
  buildOverallOverview,
  buildOverviewSentence,
  emptyCounts,
  selectGoals,
  sortByGap,
  statusOf,
  summarizeParts,
  tallyGrades,
} from './instructor-overview';

const counts = (c: Partial<Record<Grade, number>>) => ({ ...emptyCounts(), ...c });

function course(
  id: string,
  code: string,
  dist: Partial<Record<Grade, number>>,
  overrides: Partial<InstructorCourseSummary> = {},
): InstructorCourseSummary {
  return {
    courseId: id,
    code,
    name: `วิชา ${code}`,
    studentCount: 0,
    atRiskStudents: [],
    achievementPercent: 0,
    achievementThreshold: 70,
    gradeDistribution: counts(dist),
    clos: [],
    plos: [],
    courseAssessment: { courseId: id, submissionCount: 0, clos: [] },
    semesterTrend: [],
    ...overrides,
  };
}

describe('grade table (same as the backend)', () => {
  it('uses the Thai 4-point scale and leaves W/I/S/U out', () => {
    expect(GRADE_POINTS).toEqual({
      A: 4, B_PLUS: 3.5, B: 3, C_PLUS: 2.5, C: 2, D_PLUS: 1.5, D: 1, F: 0,
      W: null, I: null, S: null, U: null,
    });
    expect([...ACHIEVED_GRADES].sort()).toEqual(['A', 'B', 'B_PLUS']);
  });
});

describe('summarizeParts', () => {
  it('B or above is a share of everyone except W and I', () => {
    const s = summarizeParts([{ counts: counts({ A: 2, B: 2, C: 4, F: 1, W: 1, I: 2 }), credits: 3 }]);
    expect(s).toMatchObject({ seats: 12, counted: 9, achieved: 4, f: 1, w: 1, lowSample: true });
    expect(s.achievedPercent).toBeCloseTo((4 / 9) * 100, 10);
  });

  it('grade average ignores W/I/S/U and is a plain mean inside one course', () => {
    // (4 + 3 + 2 + 0) / 4 = 2.25 ; W, S and U carry no point
    const s = summarizeParts([{ counts: counts({ A: 1, B: 1, C: 1, F: 1, W: 3, S: 1, U: 1 }), credits: 3 }]);
    expect(s.gpa).toBeCloseTo(2.25, 10);
  });

  it('weights the average by credits across courses, but the share by seats', () => {
    // course 1: three A (3 credits); course 2: one F (1 credit)
    const s = summarizeParts([
      { counts: counts({ A: 3 }), credits: 3 },
      { counts: counts({ F: 1 }), credits: 1 },
    ]);
    expect(s.gpa).toBeCloseTo((3 * 4 * 3 + 0) / (3 * 3 + 1), 10); // 36 / 10 = 3.6
    expect(s.achievedPercent).toBe(75); // 3 of 4 seats, credits do not matter
  });

  it('has no share and no average when nobody has a counted grade', () => {
    const s = summarizeParts([{ counts: counts({ W: 2 }), credits: 3 }]);
    expect(s).toMatchObject({ seats: 2, counted: 0, achievedPercent: null, gpa: null, w: 2 });
    expect(summarizeParts([])).toMatchObject({ seats: 0, achievedPercent: null, gpa: null });
  });

  it('flags a small sample under 10 people, not at 10', () => {
    expect(summarizeParts([{ counts: counts({ A: 9 }), credits: 3 }]).lowSample).toBe(true);
    expect(summarizeParts([{ counts: counts({ A: 10 }), credits: 3 }]).lowSample).toBe(false);
  });

  it('one course needs no credits: the average is the plain mean', () => {
    expect(summarizeParts([{ counts: counts({ A: 1, C: 1 }), credits: null }]).gpa).toBe(3);
    expect(summarizeParts([{ counts: counts({ A: 1 }), credits: Number.NaN }]).gpa).toBe(4);
  });

  it('several courses: the average is unknown when any course with a graded seat has no credits', () => {
    const known = { counts: counts({ A: 1 }), credits: 3 };
    expect(summarizeParts([known, { counts: counts({ F: 1 }), credits: null }]).gpa).toBeNull();
    expect(summarizeParts([known, { counts: counts({ F: 1 }), credits: 0 }]).gpa).toBeNull();
    // a course with only W (no grade point) does not need credits
    expect(summarizeParts([known, { counts: counts({ W: 2 }), credits: null }]).gpa).toBe(4);
    // the share at B or above never depends on credits
    expect(summarizeParts([known, { counts: counts({ F: 1 }), credits: null }]).achievedPercent).toBe(50);
  });
});

describe('statusOf', () => {
  it('has four states: met, within 5 points, below, no grade', () => {
    expect(statusOf(70, 70)).toBe('met');
    expect(statusOf(95, 70)).toBe('met');
    expect(statusOf(65, 70)).toBe('near');
    expect(statusOf(64.9, 70)).toBe('below');
    expect(statusOf(0, 70)).toBe('below');
    expect(statusOf(null, 70)).toBe('none');
    expect(statusOf(60, null)).toBe('none');
    expect(statusOf(Number.NaN, 70)).toBe('none');
  });
});

describe('course overviews', () => {
  const courses = [
    course('a', 'CS101', { A: 6, B: 2, F: 2 }),   // 80% -> met
    course('b', 'CS102', { B: 4, C: 3, W: 1 }),   // 4/7 = 57% -> below (gap 12.9)
    course('c', 'CS103', { A: 3, C: 2 }),         // 60% -> below (gap 10)
    course('d', 'CS104', { W: 2 }),               // none
    course('e', 'CS105', { A: 7, C: 3 }, { achievementThreshold: 72 }), // 70% vs 72 -> near
  ];
  const overviews = buildCourseOverviews(courses, new Map([['a', 3], ['b', 3], ['c', 2], ['d', 3], ['e', 3]]));

  it('classifies each course', () => {
    expect(overviews.map((o) => o.status)).toEqual(['met', 'below', 'below', 'none', 'near']);
    expect(overviews[3].stats.achievedPercent).toBeNull();
    expect(overviews[4].gap).toBeCloseTo(2, 10);
  });

  it('sorts the furthest from its goal first and courses without a grade last', () => {
    expect(sortByGap(overviews).map((o) => o.course.code)).toEqual([
      'CS102', 'CS103', 'CS105', 'CS101', 'CS104',
    ]);
  });

  it('combines courses: share by seat, average by credit, target by counted seat', () => {
    const all = buildOverallOverview(overviews, new Map([['a', 3], ['b', 3], ['c', 2], ['d', 3], ['e', 3]]));
    // achieved: 8 + 4 + 3 + 0 + 7 = 22 ; counted: 10 + 7 + 5 + 0 + 10 = 32
    expect(all.stats).toMatchObject({ counted: 32, achieved: 22, f: 2, w: 3 });
    expect(all.stats.achievedPercent).toBeCloseTo((22 / 32) * 100, 10);
    expect(all.target).toBeCloseTo((70 * 10 + 70 * 7 + 70 * 5 + 72 * 10) / 32, 10);
  });

  it('the overall average is null without credits, even for a single course, while the course keeps its own', () => {
    const one = buildCourseOverviews([course('a', 'CS101', { A: 1, C: 1 })]);
    expect(one[0].stats.gpa).toBe(3);
    expect(buildOverallOverview(one).stats.gpa).toBe(3); // one course: plain mean, as the course itself
    const two = buildCourseOverviews([course('a', 'CS101', { A: 1 }), course('b', 'CS102', { F: 1 })]);
    expect(buildOverallOverview(two).stats.gpa).toBeNull();
    expect(buildOverallOverview(two, new Map([['a', 3]])).stats.gpa).toBeNull();
    expect(buildOverallOverview(two, new Map([['a', 3], ['b', 1]])).stats.gpa).toBeCloseTo(3, 10);
  });

  it('reads the same numbers as the course card: seats equal the course head count', () => {
    expect(overviews[0].stats.counted).toBe(10);
  });
});

describe('breakdownByYearLevel', () => {
  const rows = [
    { studentProfileId: 's1', courseId: 'a', grade: 'A' as Grade },
    { studentProfileId: 's2', courseId: 'a', grade: 'F' as Grade },
    { studentProfileId: 's1', courseId: 'b', grade: 'B' as Grade },
    { studentProfileId: 's3', courseId: 'b', grade: 'C' as Grade },
    { studentProfileId: 's9', courseId: 'b', grade: 'A' as Grade }, // not in the year-level report
  ];
  const levels = new Map([['s1', 2], ['s2', 2], ['s3', 3]]);
  const out = breakdownByYearLevel(rows, levels, new Map([['a', 3], ['b', 3]]));

  it('splits each course by year level and counts the seats it could not place', () => {
    expect(out.unplaced).toBe(1);
    const a = out.byCourse.get('a')!;
    expect(a.map((c) => c.yearLevel)).toEqual([2]);
    expect(a[0].stats).toMatchObject({ seats: 2, achieved: 1, f: 1 });
    expect(out.byCourse.get('b')!.map((c) => [c.yearLevel, c.stats.seats])).toEqual([[2, 1], [3, 1]]);
  });

  it('adds up across courses for each year level and leaves empty levels out', () => {
    expect(out.overall.map((c) => [c.yearLevel, c.stats.seats])).toEqual([[2, 3], [3, 1]]);
    const y2 = out.overall[0].stats;
    expect(y2.achievedPercent).toBeCloseTo((2 / 3) * 100, 10); // A, B of A, F, B
    expect(y2.gpa).toBeCloseTo((4 + 0 + 3) / 3, 10);
  });
});

describe('selectGoals', () => {
  const clos = (...met: boolean[]) =>
    met.map((isAchieved, i) => ({ cloId: `x${i}`, code: `CLO${i + 1}`, description: `ข้อ ${i + 1}`, threshold: 70, isAchieved }));
  const ov = buildCourseOverviews([
    course('a', 'CS101', { A: 8, F: 2 }, { clos: clos(true, true) }),
    course('b', 'CS102', { B: 4, C: 6 }, { clos: clos(false, false, true) }),
  ]);

  it('puts unmet goals first (furthest course first) and caps the list', () => {
    const { rows, unmet, total } = selectGoals(ov, 4);
    expect({ unmet, total }).toEqual({ unmet: 2, total: 5 });
    expect(rows.map((r) => `${r.courseCode}:${r.cloCode}:${r.met}`)).toEqual([
      'CS102:CLO1:false', 'CS102:CLO2:false', 'CS102:CLO3:true', 'CS101:CLO1:true',
    ]);
  });

  it('is empty without goals', () => {
    expect(selectGoals(buildCourseOverviews([course('a', 'CS101', { A: 1 })])).rows).toEqual([]);
  });
});

describe('buildOverviewSentence', () => {
  it('says the share against the goal, the average, the worst course and the small sample', () => {
    const credits = new Map([['a', 3], ['b', 3]]);
    const ov = buildCourseOverviews([course('a', 'CS101', { A: 2, F: 2 }), course('b', 'CS102', { B: 3 })], credits);
    expect(buildOverviewSentence(buildOverallOverview(ov, credits), ov)).toBe(
      'ได้ B ขึ้นไป 71% จากเกณฑ์ 70% (ถึงเกณฑ์) · เกรดเฉลี่ย 2.43 · ห่างเกณฑ์มากสุด CS101 วิชา CS101 50% · นิสิตน้อย (7 คน)',
    );
  });

  it('leaves the average out of the sentence when credits are unknown', () => {
    const ov = buildCourseOverviews([course('a', 'CS101', { A: 2, F: 2 }), course('b', 'CS102', { B: 3 })]);
    expect(buildOverviewSentence(buildOverallOverview(ov), ov)).not.toContain('เกรดเฉลี่ย');
  });

  it('is null with nobody to count, and never prints NaN or undefined', () => {
    const none = buildCourseOverviews([course('a', 'CS101', { W: 3 })]);
    expect(buildOverviewSentence(buildOverallOverview(none), none)).toBeNull();
    expect(buildOverviewSentence(buildOverallOverview([]), [])).toBeNull();
    const text = JSON.stringify(buildOverallOverview(none));
    expect(text).not.toMatch(/NaN|undefined/);
  });
});

describe('tallyGrades', () => {
  it('counts known grades and ignores anything else', () => {
    expect(tallyGrades(['A', 'A', 'F', 'X' as Grade])).toEqual(counts({ A: 2, F: 1 }));
  });
});

describe('buildCourseYearMatrix', () => {
  const ov = buildCourseOverviews([
    course('a', 'CS101', { A: 2, F: 1, W: 1 }),
    course('b', 'CS102', { B: 1, C: 1 }),
    course('c', 'CS103', { A: 1 }),
  ]);
  const rows = [
    { studentProfileId: 's1', courseId: 'a', grade: 'A' as Grade },
    { studentProfileId: 's2', courseId: 'a', grade: 'A' as Grade },
    { studentProfileId: 's3', courseId: 'a', grade: 'F' as Grade },
    { studentProfileId: 's4', courseId: 'a', grade: 'W' as Grade },
    { studentProfileId: 's1', courseId: 'b', grade: 'B' as Grade },
    { studentProfileId: 's3', courseId: 'b', grade: 'C' as Grade },
    { studentProfileId: 's1', courseId: 'c', grade: 'A' as Grade },
  ];
  const levels = new Map([['s1', 2], ['s2', 2], ['s3', 3], ['s4', 3]]);
  const m = buildCourseYearMatrix(ov, rows, levels);

  it('has a column only for year levels that have someone, and rows by course code', () => {
    expect(m.levels).toEqual([2, 3]);
    expect(m.rows.map((r) => r.course.code)).toEqual(['CS101', 'CS102', 'CS103']);
    expect(m.rows[0]).not.toHaveProperty('totalStatus');
    expect(m.rows[0]).not.toHaveProperty('target');
  });

  it('leaves a cell empty (null) where a course has nobody at that level', () => {
    const cs103 = m.rows.find((r) => r.course.code === 'CS103')!;
    expect(cs103.cells[0]?.stats.seats).toBe(1);
    expect(cs103.cells[1]).toBeNull();
  });

  it('every cell is the share of that course at that level, and W is not counted', () => {
    const cs101 = m.rows.find((r) => r.course.code === 'CS101')!;
    expect(cs101.cells[0]?.stats.achievedPercent).toBe(100); // s1, s2: A, A
    expect(cs101.cells[1]?.stats).toMatchObject({ seats: 2, counted: 1, achievedPercent: 0, w: 1, f: 1 });
  });

  it('the row total is the course figure and the footer adds every course', () => {
    const cs101 = m.rows.find((r) => r.course.code === 'CS101')!;
    expect(cs101.total.seats).toBe(4);
    expect(m.footer.total.seats).toBe(7);
    expect(m.footer.cells[0]?.stats.seats).toBe(4); // level 2: s1 in a, b, c and s2 in a
    expect(m.footer.cells[1]?.stats.seats).toBe(3);
  });

  it('counts seats whose student has no year level, and has no columns without any', () => {
    expect(buildCourseYearMatrix(ov, rows, new Map()).levels).toEqual([]);
    expect(buildCourseYearMatrix(ov, rows, new Map()).unplaced).toBe(7);
  });
});
