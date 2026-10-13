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
