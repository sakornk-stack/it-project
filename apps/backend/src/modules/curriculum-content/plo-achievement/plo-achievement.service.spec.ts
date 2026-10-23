import { PloAchievementService } from './plo-achievement.service';

function build(overrides: {
  cloReport?: unknown;
  mappings?: unknown[];
  courses?: unknown[];
  clos?: unknown[];
  summarize?: (m: unknown) => unknown;
}) {
  const prisma = {
    cloPloMapping: { findMany: jest.fn().mockResolvedValue(overrides.mappings ?? []) },
    course: { findMany: jest.fn().mockResolvedValue(overrides.courses ?? []) },
    clo: { findMany: jest.fn().mockResolvedValue(overrides.clos ?? []) },
  };
  const cloAchievementService = {
    calculateForCourse: jest.fn().mockResolvedValue(overrides.cloReport),
    summarizeCourseAchievement: jest.fn((m: unknown) => overrides.summarize?.(m)),
  };
  const studentCourseRecordService = {
    findActiveRecordsForCourses: jest.fn().mockResolvedValue([]),
    dedupeLatestPerStudent: jest.fn((r: unknown[]) => r),
  };
  const service = new PloAchievementService(
    prisma as never,
    undefined as never,
    studentCourseRecordService as never,
    cloAchievementService as never,
    undefined as never,
    undefined as never,
  );
  return service;
}

const plo = (id: string) => ({ id, code: id, name: id });

describe('PloAchievementService.calculateForCourse — no-data CLOs', () => {
  const clos = [{ cloId: 'c1', code: 'CLO1' }];

  it('gives a null PLO percent (not 0) when the course has no graded student', async () => {
    const service = build({
      cloReport: { courseId: 'x', achievementPercent: null, clos },
      mappings: [{ cloId: 'c1', ploId: 'p1', weight: 2, plo: plo('p1') }],
    });
    const report = await service.calculateForCourse('x');
    expect(report.achievementPercent).toBeNull();
    expect(report.plos).toHaveLength(1);
    expect(report.plos[0].achievementPercent).toBeNull();
    expect(report.plos[0].cloBreakdown).toHaveLength(1);
  });

  it('keeps a real 0 as 0', async () => {
    const service = build({
      cloReport: { courseId: 'x', achievementPercent: 0, clos },
      mappings: [{ cloId: 'c1', ploId: 'p1', weight: 2, plo: plo('p1') }],
    });
    const report = await service.calculateForCourse('x');
    expect(report.plos[0].achievementPercent).toBe(0);
  });

  it('weights a measured value normally', async () => {
    const service = build({
      cloReport: { courseId: 'x', achievementPercent: 60, clos },
      mappings: [{ cloId: 'c1', ploId: 'p1', weight: 3, plo: plo('p1') }],
    });
    const report = await service.calculateForCourse('x');
    expect(report.plos[0].achievementPercent).toBe(60);
  });
});

describe('PloAchievementService.buildCourseAnalytics — lowest CLOs', () => {
  it('skips courses with no data and reports null in courseAnalytics', async () => {
    const percents: Record<string, number | null> = { a: null, b: 40, c: 0 };
    let call = 0;
    const order = ['a', 'b', 'c'];
    const service = build({
      courses: order.map((id) => ({ id, code: id, name: id })),
      clos: order.map((id) => ({ id: `clo-${id}`, courseId: id, code: id, description: id })),
      summarize: () => ({ achievementPercent: percents[order[call++]] }),
    });
    const { courseAnalytics, lowestClos } = await (
      service as unknown as {
        buildCourseAnalytics(id: string): Promise<{
          courseAnalytics: { achievementPercent: number | null }[];
          lowestClos: { courseId: string; achievementPercent: number }[];
        }>;
      }
    ).buildCourseAnalytics('cur');
    expect(courseAnalytics.map((c) => c.achievementPercent)).toEqual([null, 40, 0]);
    // real 0% (course c) is the lowest; no-data course a is never picked
    expect(lowestClos.map((c) => c.courseId)).toEqual(['c']);
  });

  it('returns no lowest CLO when no course has data', async () => {
    const service = build({
      courses: [{ id: 'a', code: 'a', name: 'a' }],
      clos: [{ id: 'clo-a', courseId: 'a', code: 'a', description: 'a' }],
      summarize: () => ({ achievementPercent: null }),
    });
    const { lowestClos } = await (
      service as unknown as {
        buildCourseAnalytics(id: string): Promise<{ lowestClos: unknown[] }>;
      }
    ).buildCourseAnalytics('cur');
    expect(lowestClos).toEqual([]);
  });
});

describe('PloAchievementService: PLOs come out in code order, whatever order the database returns', () => {
  // PLO has no sortOrder and its queries have no orderBy, so rows arrive in
  // physical order. PLO5 first is the case seen on the ADMIN curriculum page.
  const unordered = ['PLO5', 'PLO1', 'PLO10', 'PLO2', 'PLO3', 'PLO4', 'PLO6'].map((code) => ({
    id: `id-${code}`,
    code,
    name: code,
    cloMappings: [],
  }));
  const ordered = ['PLO1', 'PLO2', 'PLO3', 'PLO4', 'PLO5', 'PLO6', 'PLO10'];

  it('calculateForCurriculum (ADMIN page): the radar axes follow the code order', async () => {
    const prisma = {
      plo: { findMany: jest.fn().mockResolvedValue(unordered) },
      studentProfile: { findMany: jest.fn().mockResolvedValue([]) },
      course: { findMany: jest.fn().mockResolvedValue([]) },
      clo: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PloAchievementService(
      prisma as never,
      undefined as never,
      {
        findActiveRecordsForStudents: jest.fn().mockResolvedValue([]),
        findActiveRecordsForCourses: jest.fn().mockResolvedValue([]),
      } as never,
      undefined as never,
      { findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'cur' }) } as never,
      { loadCurriculumTree: jest.fn().mockResolvedValue({}) } as never,
    );
    const report = await service.calculateForCurriculum('cur');
    expect(report.radar.map((p) => p.code)).toEqual(ordered);
    // Order only: nothing was measured, so every value is still "no data".
    expect(report.radar.every((p) => p.value === null)).toBe(true);
  });

  it('calculateForCourse: the PLO entries follow the code order', async () => {
    const service = build({
      cloReport: { courseId: 'x', achievementPercent: 80, clos: [{ cloId: 'c1', code: 'CLO1' }] },
      mappings: ['PLO5', 'PLO1', 'PLO10', 'PLO2'].map((code) => ({
        cloId: 'c1',
        ploId: `p-${code}`,
        weight: 1,
        plo: { id: `p-${code}`, code, name: code },
      })),
    });
    const report = await service.calculateForCourse('x');
    expect(report.plos.map((p) => p.code)).toEqual(['PLO1', 'PLO2', 'PLO5', 'PLO10']);
    expect(report.plos.every((p) => p.achievementPercent === 80)).toBe(true);
  });
});

describe('PloAchievementService.buildCohortComparison', () => {
  type Build = (
    curriculumId: string,
    students: unknown[],
    plos: unknown[],
    cohortGpas: Map<number, number[]>,
    cohortPloSums: Map<number, Map<string, { sum: number; count: number }>>,
  ) => { admissionYear: number; studentCount: number; averageGpa: number | null; gpaSampleSize: number }[];

  it('keeps a cohort whose students have no grades yet, with a null GPA', () => {
    const service = build({});
    const buildCohorts: Build = (service as unknown as { buildCohortComparison: Build }).buildCohortComparison.bind(service);
    const students = [{ admissionYear: 2566 }, { admissionYear: 2566 }, { admissionYear: 2568 }];
    const cohorts = buildCohorts('cur', students, [], new Map([[2566, [3, 3.5]]]), new Map());

    expect(cohorts.map((c) => c.admissionYear)).toEqual([2566, 2568]);
    expect(cohorts[0]).toMatchObject({ studentCount: 2, averageGpa: 3.25, gpaSampleSize: 2 });
    expect(cohorts[1]).toMatchObject({ studentCount: 1, averageGpa: null, gpaSampleSize: 0 });
  });
});
