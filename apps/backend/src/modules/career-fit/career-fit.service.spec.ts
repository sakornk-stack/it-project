import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../auth/request-user.interface';
import { StudentCourseRecordService } from '../academic-record/student-course-record/student-course-record.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { CareerFitService } from './career-fit.service';

function build() {
  const prisma = { career: { findMany: jest.fn().mockResolvedValue([]) } };
  const profiles = {
    findByUserId: jest.fn().mockResolvedValue({ id: 'p1', curriculumId: 'cur1' }),
  };
  const records = {
    getLatestAttemptsPerCourse: jest.fn().mockResolvedValue(new Map()),
  };
  const service = new CareerFitService(
    prisma as unknown as PrismaService,
    profiles as unknown as StudentProfileService,
    records as unknown as StudentCourseRecordService,
  );
  return { service, prisma, profiles, records };
}

describe('CareerFitService', () => {
  it('uses only the caller own profile and curriculum', async () => {
    const { service, prisma, profiles, records } = build();
    await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
    expect(profiles.findByUserId).toHaveBeenCalledWith('u1');
    expect(records.getLatestAttemptsPerCourse).toHaveBeenCalledWith('p1');
    const args = prisma.career.findMany.mock.calls[0][0];
    expect(args.include.courses.where.course.curriculumId).toBe('cur1');
  });

  const career = (id: string, courseCount: number) => ({
    id,
    name: `สาย ${id}`,
    sortOrder: 0,
    courses: Array.from({ length: courseCount }, (_, i) => ({
      weight: 1,
      course: { id: `${id}${i}`, code: `C${id}${i}`, name: `วิชา ${i}` },
    })),
  });

  it('returns NO_CAREERS when the curriculum has no career links', async () => {
    const { service, prisma } = build();
    prisma.career.findMany.mockResolvedValue([career('a', 0)]);
    const r = await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
    expect(r.status).toBe('NO_CAREERS');
  });

  it('keeps careers with 2 or 3 linked courses; fewer than 3 graded is INSUFFICIENT_DATA', async () => {
    const { service, prisma, records } = build();
    records.getLatestAttemptsPerCourse.mockResolvedValue(
      new Map([
        ['b0', { grade: 'A' }],
        ['c0', { grade: 'A' }],
        ['c1', { grade: 'A' }],
        ['c2', { grade: 'A' }],
      ]),
    );
    prisma.career.findMany.mockResolvedValue([career('a', 0), career('b', 2), career('c', 3)]);
    const r = await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
    expect(r.careers.map((c) => [c.careerId, c.status, c.totalCourseCount])).toEqual([
      ['c', 'OK', 3],
      ['b', 'INSUFFICIENT_DATA', 2],
    ]);
  });

  it('maps latest attempt grades into the score', async () => {
    const { service, prisma, records } = build();
    prisma.career.findMany.mockResolvedValue([
      {
        id: 'a',
        name: 'ก',
        sortOrder: 0,
        courses: ['1', '2', '3'].map((i) => ({
          weight: 1,
          course: { id: i, code: `C${i}`, name: `วิชา ${i}` },
        })),
      },
    ]);
    records.getLatestAttemptsPerCourse.mockResolvedValue(
      new Map(['1', '2', '3'].map((i) => [i, { grade: 'A' }])),
    );
    const r = await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
    expect(r.careers[0]).toMatchObject({ score: 100, level: 'HIGH' });
  });
  describe('career groups', () => {
    const grouped = (over: Record<string, unknown>) => ({
      ...career('a', 3),
      description: 'คำอธิบายสาย',
      ...over,
    });
    const group = (isActive: boolean) => ({
      id: 'g1',
      name: 'Software Development',
      description: null,
      sortOrder: 0,
      isActive,
    });

    it('asks for the group and passes description and active group through', async () => {
      const { service, prisma, records } = build();
      records.getLatestAttemptsPerCourse.mockResolvedValue(
        new Map(['a0', 'a1', 'a2'].map((id) => [id, { grade: 'A' }])),
      );
      prisma.career.findMany.mockResolvedValue([grouped({ group: group(true) })]);
      const r = await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
      expect(prisma.career.findMany.mock.calls[0][0].include.group).toBeDefined();
      expect(r.careers[0].description).toBe('คำอธิบายสาย');
      expect(r.careers[0].group).toEqual({
        id: 'g1',
        name: 'Software Development',
        description: null,
        sortOrder: 0,
      });
    });

    it('treats a deactivated group and a missing group as no group', async () => {
      const { service, prisma, records } = build();
      records.getLatestAttemptsPerCourse.mockResolvedValue(
        new Map(['a0', 'a1', 'a2', 'b0', 'b1', 'b2'].map((id) => [id, { grade: 'A' }])),
      );
      prisma.career.findMany.mockResolvedValue([
        grouped({ group: group(false) }),
        { ...career('b', 3), description: null, group: null },
      ]);
      const r = await service.getMyCareerFit({ userId: 'u1' } as RequestUser);
      expect(r.careers.map((c) => c.group)).toEqual([null, null]);
      expect(r.careers.find((c) => c.careerId === 'b')?.description).toBeNull();
    });
  });
});
