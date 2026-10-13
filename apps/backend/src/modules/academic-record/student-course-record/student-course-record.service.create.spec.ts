import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentCourseRecordService } from './student-course-record.service';

const PROFILE = { id: 'p1', curriculumId: 'cur-A', isActive: true };

function user(roles: Role[]): RequestUser {
  return { userId: 'u1', email: 'u1@x.test', roles, mustChangePassword: false };
}

function setup(courseCurriculumId: string, covered = true) {
  const prisma = {
    studentCourseRecord: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
  };
  const studentProfileService = {
    findByUserId: jest.fn().mockResolvedValue(PROFILE),
    findActiveByIdOrThrow: jest.fn().mockResolvedValue(PROFILE),
  };
  const courseService = {
    findActiveByIdOrThrow: jest
      .fn()
      .mockResolvedValue({ id: 'c1', credits: 3, curriculumId: courseCurriculumId }),
  };
  const semesterService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) };
  const scopeResolver = {
    resolveAncestry: jest.fn().mockResolvedValue({}),
    getEffectiveScopes: jest.fn().mockResolvedValue([]),
    isCovered: jest.fn().mockReturnValue(covered),
  };
  const service = new StudentCourseRecordService(
    prisma as never,
    studentProfileService as never,
    courseService as never,
    semesterService as never,
    scopeResolver as never,
  );
  return { service, prisma };
}

const dto = { studentProfileId: 'p1', courseId: 'c1', semesterId: 's1', grade: 'A' } as never;

describe('StudentCourseRecordService.create curriculum check', () => {
  it('rejects a STAFF adding a course from another curriculum, in Thai', async () => {
    const { service, prisma } = setup('cur-B');
    const error = await service.create(dto, user(['STAFF'])).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toContain('ไม่อยู่ในหลักสูตรของนิสิต');
    expect(prisma.studentCourseRecord.create).not.toHaveBeenCalled();
  });

  it('rejects a STUDENT adding a course from another curriculum', async () => {
    const { service } = setup('cur-B');
    await expect(service.create(dto, user(['STUDENT']))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lets a STUDENT add a course of their own curriculum', async () => {
    const { service, prisma } = setup('cur-A');
    await service.create(dto, user(['STUDENT']));
    expect(prisma.studentCourseRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studentProfileId: 'p1', courseId: 'c1' }),
      }),
    );
  });

  it('lets a STAFF add a course of the student curriculum', async () => {
    const { service, prisma } = setup('cur-A');
    await service.create(dto, user(['STAFF']));
    expect(prisma.studentCourseRecord.create).toHaveBeenCalled();
  });

  it('still refuses a STAFF outside scope before looking at the course', async () => {
    const { service } = setup('cur-A', false);
    await expect(service.create(dto, user(['STAFF']))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
