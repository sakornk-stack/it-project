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
