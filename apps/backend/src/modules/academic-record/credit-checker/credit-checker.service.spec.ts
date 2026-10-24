import {
  CreditCheckerService,
  CreditCheckCurriculumTree,
} from './credit-checker.service';
import {
  LatestCourseAttempt,
  StudentCourseRecordService,
} from '../student-course-record/student-course-record.service';

// computeCreditCheck is pure (no I/O), so the injected services are never touched.
const service = new CreditCheckerService({} as never, {} as never, {} as never);

function course(id: string, credits: number) {
  return {
    id,
    code: id,
    name: id,
    credits,
    isRequired: true,
    prerequisitesRequired: [],
  };
}

function tree(totalCredits: number, courses: ReturnType<typeof course>[]) {
  return {
    id: 'cur',
    totalCredits,
    categories: [{ id: 'cat', requirement: null, courses }],
  } as unknown as CreditCheckCurriculumTree;
}

function attempts(...ids: string[]) {
  return new Map(
    ids.map((id) => [id, { grade: 'A' } as unknown as LatestCourseAttempt]),
  );
}

const profile = { id: 'student', curriculumId: 'cur' };

describe('CreditCheckerService.computeCreditCheck — remaining credits', () => {
  const courses = [course('c1', 4), course('c2', 4)];

  it('shows the shortfall when credits are incomplete', () => {
    const report = service.computeCreditCheck(
      profile,
      tree(10, courses),
      attempts('c1'),
    );
    expect(report.creditsPassed).toBe(4);
    expect(report.creditsRemaining).toBe(6);
    expect(report.graduationReadiness.creditsMet).toBe(false);
  });

  it('is 0 remaining when credits match exactly', () => {
    const report = service.computeCreditCheck(
      profile,
      tree(8, courses),
      attempts('c1', 'c2'),
    );
    expect(report.creditsPassed).toBe(8);
    expect(report.creditsRemaining).toBe(0);
    expect(report.graduationReadiness.creditsMet).toBe(true);
  });

  it('clamps remaining to 0 but keeps the real earned credits and creditsMet when over the requirement', () => {
    const report = service.computeCreditCheck(
      profile,
      tree(6, courses),
      attempts('c1', 'c2'),
    );
    expect(report.creditsPassed).toBe(8);
    expect(report.creditsAccumulated).toBe(8);
    expect(report.creditsRemaining).toBe(0);
    expect(report.totalCreditsRequired).toBe(6);
    expect(report.graduationReadiness.creditsMet).toBe(true);
    expect(report.graduationReadiness.isReady).toBe(true);
  });

  it('is 0 remaining when the curriculum requires 0 credits', () => {
    const report = service.computeCreditCheck(
      profile,
      tree(0, courses),
      attempts('c1'),
    );
    expect(report.creditsPassed).toBe(4);
    expect(report.creditsRemaining).toBe(0);
  });
});

describe('CreditCheckerService.computeCreditCheck — W after an earlier outcome', () => {
  const records = new StudentCourseRecordService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const rec = (
    id: string,
    courseId: string,
    grade: string,
    year: number,
    term: 'FIRST' | 'SECOND',
  ) =>
    ({
      id,
      courseId,
      grade,
      studentProfileId: 'student',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      semester: { term, academicYear: { year } },
    }) as unknown as LatestCourseAttempt;
  const courses = [course('c1', 4), course('c2', 4)];

  it('keeps an earlier PASS counted when a later retake is withdrawn', () => {
    const latest = records.dedupeLatestPerCourse([
      rec('a', 'c1', 'B', 2565, 'FIRST'),
      rec('b', 'c1', 'W', 2566, 'FIRST'),
    ]);
    const report = service.computeCreditCheck(profile, tree(8, courses), latest);
    expect(report.passedCourses.map((c) => c.courseId)).toEqual(['c1']);
    expect(report.creditsPassed).toBe(4);
    expect(report.missingRequiredCourses.map((c) => c.courseId)).toEqual(['c2']);
  });

  it('keeps an earlier F in failedCourses when a later retake is withdrawn', () => {
    const latest = records.dedupeLatestPerCourse([
      rec('a', 'c1', 'F', 2565, 'FIRST'),
      rec('b', 'c1', 'W', 2566, 'FIRST'),
    ]);
    const report = service.computeCreditCheck(profile, tree(8, courses), latest);
    expect(report.failedCourses.map((c) => c.courseId)).toEqual(['c1']);
    expect(report.creditsStudied).toBe(4);
    expect(report.creditsPassed).toBe(0);
  });

  it('leaves a course with only a W in the not-yet-studied bucket', () => {
    const latest = records.dedupeLatestPerCourse([rec('a', 'c1', 'W', 2565, 'FIRST')]);
    const report = service.computeCreditCheck(profile, tree(8, courses), latest);
    expect(report.notYetStudiedCourses.map((c) => c.courseId)).toContain('c1');
    expect(report.creditsStudied).toBe(0);
  });
});

describe('CreditCheckerService.computeCreditCheck — free electives take the overflow', () => {
  function treeWith(categories: { id: string; name: string; min: number; courses: ReturnType<typeof course>[] }[]) {
    return {
      id: 'cur',
      totalCredits: 20,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        requirement: { minCredits: c.min, minCourses: null },
        courses: c.courses,
      })),
    } as unknown as CreditCheckCurriculumTree;
  }
  const curriculum = treeWith([
    { id: 'ge', name: 'กลุ่มสาระภาษากับการสื่อสาร', min: 3, courses: [course('g1', 3), course('g2', 3), course('g3', 3)] },
    { id: 'major', name: 'วิชาเฉพาะเลือก', min: 3, courses: [course('m1', 3), course('m2', 2)] },
    { id: 'free', name: 'วิชาเลือกเสรี', min: 6, courses: [] },
  ]);
  const progressOf = (ids: string[]) =>
    Object.fromEntries(
      service
        .computeCreditCheck(profile, curriculum, attempts(...ids))
        .categoryProgress.map((c) => [c.categoryId, c]),
    );

  it('counts credits beyond each category minimum as free electives', () => {
    const p = progressOf(['g1', 'g2', 'g3', 'm1', 'm2']);
    // GE 9 of 3 (+6), major 5 of 3 (+2): free gets 8 of 6.
    expect(p.free).toMatchObject({ creditsEarned: 8, creditsFromOtherCategories: 8, isComplete: true });
    // The other categories keep what they earned.
    expect(p.ge).toMatchObject({ creditsEarned: 9, isComplete: true });
    expect(p.major).toMatchObject({ creditsEarned: 5, isComplete: true });
  });

  it('leaves the free-elective category short when there is not enough overflow', () => {
    const p = progressOf(['g1', 'g2', 'm1']);
    expect(p.free).toMatchObject({ creditsEarned: 3, creditsFromOtherCategories: 3, isComplete: false });
  });

  it('adds nothing when no category goes over its minimum', () => {
    const p = progressOf(['g1', 'm1']);
    expect(p.free.creditsEarned).toBe(0);
    expect(p.free.creditsFromOtherCategories).toBeUndefined();
  });

  it('never changes the curriculum total, so nothing is counted twice', () => {
    const report = service.computeCreditCheck(profile, curriculum, attempts('g1', 'g2', 'g3', 'm1', 'm2'));
    expect(report.creditsPassed).toBe(14);
    expect(report.graduationReadiness.allCategoriesMet).toBe(true);
    expect(report.graduationReadiness.creditsMet).toBe(false);
  });

  it('leaves a curriculum without a free-elective category as it was', () => {
    const report = service.computeCreditCheck(profile, tree(8, [course('c1', 4), course('c2', 4)]), attempts('c1', 'c2'));
    expect(report.categoryProgress[0].creditsFromOtherCategories).toBeUndefined();
  });
});
