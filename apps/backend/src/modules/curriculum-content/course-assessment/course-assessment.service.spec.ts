import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentProfileService } from '../../users/student-profile/student-profile.service';
import { CourseService } from '../course/course.service';
import { CourseAssessmentService } from './course-assessment.service';

const user = { userId: 'user-1' } as RequestUser;

function setup(opts: {
  assessableCourseIds: string[];
  assessedCount?: number;
  assessments?: unknown[];
  profileMissing?: boolean;
}) {
  const prisma = {
    studentCourseRecord: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          opts.assessableCourseIds.map((courseId) => ({ courseId })),
        ),
    },
    courseAssessment: {
      count: jest.fn().mockResolvedValue(opts.assessedCount ?? 0),
      findMany: jest.fn().mockResolvedValue(opts.assessments ?? []),
    },
  };
  const studentProfileService = {
    findByUserId: opts.profileMissing
      ? jest.fn().mockRejectedValue(new NotFoundException())
      : jest.fn().mockResolvedValue({ id: 'profile-1' }),
  };
  const service = new CourseAssessmentService(
    prisma as unknown as PrismaService,
    studentProfileService as unknown as StudentProfileService,
    {} as CourseService,
  );
  return { service, prisma, studentProfileService };
}

describe('CourseAssessmentService pending count', () => {
  it('pending = assessable minus assessed', async () => {
    const { service } = setup({
      assessableCourseIds: ['c1', 'c2', 'c3'],
      assessedCount: 1,
    });
    expect(await service.countPendingForStudent('profile-1')).toBe(2);
  });

  it('returns 0 without querying assessments when nothing is assessable', async () => {
    const { service, prisma } = setup({ assessableCourseIds: [] });
    expect(await service.countPendingForStudent('profile-1')).toBe(0);
    expect(prisma.courseAssessment.count).not.toHaveBeenCalled();
  });

  it('scopes to active records of courses with active CLOs, distinct per course', async () => {
    const { service, prisma } = setup({ assessableCourseIds: ['c1'] });
    await service.countPendingForStudent('profile-1');
    expect(prisma.studentCourseRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentProfileId: 'profile-1',
          isActive: true,
          course: { isActive: true, clos: { some: { isActive: true } } },
        },
        distinct: ['courseId'],
      }),
    );
  });

  it('counts only assessments of the same student in the assessable set', async () => {
    const { service, prisma } = setup({
      assessableCourseIds: ['c1', 'c2'],
      assessedCount: 2,
    });
    expect(await service.countPendingForStudent('profile-1')).toBe(0);
    expect(prisma.courseAssessment.count).toHaveBeenCalledWith({
      where: { studentProfileId: 'profile-1', courseId: { in: ['c1', 'c2'] } },
    });
  });
});

describe('CourseAssessmentService.create', () => {
  it('rejects a course whose only record was deleted (active records only)', async () => {
    const prisma = {
      studentCourseRecord: { findFirst: jest.fn().mockResolvedValue(null) },
      courseAssessment: { create: jest.fn() },
    };
    const service = new CourseAssessmentService(
      prisma as unknown as PrismaService,
      {
        findByUserId: jest.fn().mockResolvedValue({ id: 'profile-1' }),
      } as unknown as StudentProfileService,
      {
        findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'c1' }),
      } as unknown as CourseService,
    );

    await expect(
      service.create(
        { courseId: 'c1', cloScores: [{ cloId: 'clo-1', score: 3 }] },
        user,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.studentCourseRecord.findFirst).toHaveBeenCalledWith({
      where: { studentProfileId: 'profile-1', courseId: 'c1', isActive: true },
    });
    expect(prisma.courseAssessment.create).not.toHaveBeenCalled();
  });
});

describe('CourseAssessmentService.findAllOwn', () => {
  it('resolves the caller profile and scopes every query to it', async () => {
    const { service, prisma, studentProfileService } = setup({
      assessableCourseIds: ['c1', 'c2'],
      assessedCount: 1,
      assessments: [{ id: 'a1', courseId: 'c1' }],
    });
    const result = await service.findAllOwn(user);

    expect(studentProfileService.findByUserId).toHaveBeenCalledWith('user-1');
    expect(prisma.courseAssessment.findMany).toHaveBeenCalledWith({
      where: { studentProfileId: 'profile-1' },
      include: { cloScores: true },
    });
    for (const call of prisma.studentCourseRecord.findMany.mock.calls) {
      expect(call[0].where.studentProfileId).toBe('profile-1');
    }
    expect(result).toEqual({
      assessments: [{ id: 'a1', courseId: 'c1' }],
      assessableCourseCount: 2,
      pendingAssessmentCount: 1,
    });
  });

  it('throws NotFoundException when the caller has no student profile', async () => {
    const { service, prisma } = setup({
      assessableCourseIds: [],
      profileMissing: true,
    });
    await expect(service.findAllOwn(user)).rejects.toThrow(NotFoundException);
    expect(prisma.courseAssessment.findMany).not.toHaveBeenCalled();
  });
});
