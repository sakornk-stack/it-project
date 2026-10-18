import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentCourseRecordService } from './student-course-record.service';

const userWith = (...roles: Role[]) => ({ userId: 'u1', roles }) as unknown as RequestUser;

function setup(opts: { records?: unknown[]; myCourseIds?: string[] } = {}) {
  const findMany = jest.fn().mockResolvedValue(opts.records ?? []);
  const findMyCourses = jest.fn().mockResolvedValue((opts.myCourseIds ?? []).map((id) => ({ id })));
  const service = new StudentCourseRecordService(
    { studentCourseRecord: { findMany } } as never,
    {
      findActiveByIdOrThrow: jest.fn().mockResolvedValue({
        studentCode: 'S1',
        user: { fullName: 'N' },
      }),
      findByUserId: jest.fn().mockResolvedValue({ id: 'own' }),
    } as never,
    { findMyCourses } as never,
    {} as never,
    { getCoveredProgramIds: jest.fn().mockResolvedValue(['p1']) } as never,
    {} as never,
  );
  return { service, findMany };
}

describe('StudentCourseRecordService.findAll — never returns every record', () => {
  it('refuses a caller who is neither a student nor staff-tier (SUPER_ADMIN)', async () => {
    const { service, findMany } = setup();
    await expect(service.findAll(userWith('SUPER_ADMIN'))).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('still scopes STAFF to the covered programs', async () => {
    const { service, findMany } = setup();
    await service.findAll(userWith('STAFF'));
    expect(findMany.mock.calls[0][0].where).toEqual({
      studentProfile: { programId: { in: ['p1'] } },
      isActive: true,
    });
  });

  it('still scopes a STUDENT to their own profile', async () => {
    const { service, findMany } = setup();
    await service.findAll(userWith('STUDENT'));
    expect(findMany.mock.calls[0][0].where).toEqual({ studentProfileId: 'own', isActive: true });
  });
});

describe('StudentCourseRecordService.getStudentTimelineWithInstructor', () => {
  const record = {
    grade: 'A',
    course: { id: 'c1', code: 'C1', name: 'Course 1' },
    semester: { term: 'FIRST', academicYear: { year: 2568 } },
  };

  it('answers 404 when the student has no record in any course the instructor teaches', async () => {
    const { service } = setup({ records: [], myCourseIds: ['c1'] });
    await expect(service.getStudentTimelineWithInstructor('s1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('answers 404 for an instructor without any course', async () => {
    const { service, findMany } = setup({ myCourseIds: [] });
    await expect(service.getStudentTimelineWithInstructor('s1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns identity and entries for a student of the instructor', async () => {
    const { service } = setup({ records: [record], myCourseIds: ['c1'] });
    const result = await service.getStudentTimelineWithInstructor('s1', 'u1');
    expect(result.studentCode).toBe('S1');
    expect(result.entries).toHaveLength(1);
  });
});
