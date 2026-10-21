import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { StudentCourseRecordService } from './student-course-record.service';

const PROFILE = { id: 'sp1', programId: 'p1', curriculumId: 'cur-A', isActive: true };
const ROW = {
  id: 'r1',
  studentProfileId: 'sp1',
  courseId: 'c1',
  semesterId: 's1',
  grade: 'B',
  isActive: true,
  studentProfile: { programId: 'p1' },
};

function user(roles: Role[]): RequestUser {
  return { userId: 'actor', email: 'actor@x.test', roles, mustChangePassword: false };
}

function setup(opts: { duplicate?: boolean; enteredByRole?: Role | null } = {}) {
  const row = { ...ROW, enteredByRole: 'enteredByRole' in opts ? opts.enteredByRole : 'STUDENT' };
  const tx = {
    studentCourseRecord: {
      create: opts.duplicate
        ? jest
            .fn()
            .mockRejectedValue(
              new Prisma.PrismaClientKnownRequestError('dup', {
                code: 'P2002',
                clientVersion: 'x',
              }),
            )
        : jest.fn().mockResolvedValue({ ...ROW, grade: 'A' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data })),
      delete: jest.fn().mockResolvedValue(row),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    studentCourseRecord: {
      findFirst: jest.fn().mockResolvedValue(row),
      create: jest.fn().mockResolvedValue(ROW),
      update: jest.fn().mockResolvedValue(ROW),
      delete: jest.fn().mockResolvedValue(ROW),
    },
    courseInstructor: { findUnique: jest.fn().mockResolvedValue({ id: 'ci1' }) },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new StudentCourseRecordService(
    prisma as never,
    {
      findByUserId: jest.fn().mockResolvedValue(PROFILE),
      findActiveByIdOrThrow: jest.fn().mockResolvedValue(PROFILE),
    } as never,
    {
      findActiveByIdOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'c1', credits: 3, curriculumId: 'cur-A' }),
    } as never,
    { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) } as never,
    {
      resolveAncestry: jest.fn().mockResolvedValue({}),
      getEffectiveScopes: jest.fn().mockResolvedValue([]),
      isCovered: jest.fn().mockReturnValue(true),
    } as never,
    audit as never,
  );
  return { service, prisma, tx, audit };
}

const createDto = {
  studentProfileId: 'sp1',
  courseId: 'c1',
  semesterId: 's1',
  grade: 'A',
} as never;

describe('StudentCourseRecordService grade audit', () => {
  it('STAFF create: written and audited in one transaction', async () => {
    const { service, prisma, tx, audit } = setup();
    await service.create(createDto, user(['STAFF']));
    expect(prisma.studentCourseRecord.create).not.toHaveBeenCalled();
    expect(tx.studentCourseRecord.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'GRADE_CREATE',
        targetId: 'r1',
        studentProfileId: 'sp1',
        programId: 'p1',
        after: { grade: 'A', courseId: 'c1', semesterId: 's1' },
      }),
    );
  });

  it('STAFF create: a duplicate is still a 409', async () => {
    const { service, audit } = setup({ duplicate: true });
    await expect(service.create(createDto, user(['STAFF']))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each([['STAFF'], ['INSTRUCTOR']] as [Role][])(
    '%s update: before and after grade in the audit row',
    async (role) => {
      const { service, tx, audit } = setup();
      await service.update('r1', { grade: 'A' } as never, user([role]));
      expect(tx.studentCourseRecord.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'GRADE_UPDATE',
          actor: expect.objectContaining({ roles: [role] }),
          programId: 'p1',
          before: { grade: 'B', courseId: 'c1', semesterId: 's1' },
          after: { grade: 'A', courseId: 'c1', semesterId: 's1' },
        }),
      );
    },
  );

  it.each([['STAFF'], ['INSTRUCTOR']] as [Role][])(
    '%s delete: soft delete with the removed grade in the audit row',
    async (role) => {
      const { service, prisma, tx, audit } = setup();
      await service.remove('r1', user([role]));
      expect(tx.studentCourseRecord.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isActive: false },
      });
      expect(prisma.studentCourseRecord.delete).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'GRADE_DELETE',
          before: { grade: 'B', courseId: 'c1', semesterId: 's1' },
        }),
      );
    },
  );

  it('a student adding a grade of their own is not audited', async () => {
    const { service, prisma, audit } = setup();
    await service.create(createDto, user(['STUDENT']));
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.studentCourseRecord.create).toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it.each([['STUDENT'], [null]] as [Role | null][])(
    'a student may edit a row entered by %s, audited',
    async (enteredByRole) => {
      const { service, prisma, tx, audit } = setup({ enteredByRole });
      await service.update('r1', { grade: 'A' } as never, user(['STUDENT']));
      expect(prisma.studentCourseRecord.update).not.toHaveBeenCalled();
      expect(tx.studentCourseRecord.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'GRADE_UPDATE',
          actor: expect.objectContaining({ roles: ['STUDENT'] }),
          before: { grade: 'B', courseId: 'c1', semesterId: 's1' },
          after: { grade: 'A', courseId: 'c1', semesterId: 's1' },
        }),
      );
    },
  );

  it.each([['STUDENT'], [null]] as [Role | null][])(
    'a student may delete a row entered by %s: hard delete, audited',
    async (enteredByRole) => {
      const { service, prisma, tx, audit } = setup({ enteredByRole });
      await service.remove('r1', user(['STUDENT']));
      expect(tx.studentCourseRecord.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(prisma.studentCourseRecord.delete).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          action: 'GRADE_DELETE',
          before: { grade: 'B', courseId: 'c1', semesterId: 's1' },
        }),
      );
    },
  );

  it.each([['STAFF'], ['INSTRUCTOR'], ['ADMIN'], ['SUPER_ADMIN']] as [Role][])(
    'a student may not edit or delete a row entered by %s (403, nothing written)',
    async (enteredByRole) => {
      const { service, prisma, tx, audit } = setup({ enteredByRole });
      const student = user(['STUDENT']);
      await expect(service.update('r1', { grade: 'A' } as never, student)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.remove('r1', student)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.studentCourseRecord.update).not.toHaveBeenCalled();
      expect(tx.studentCourseRecord.delete).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    },
  );

  it.each([['STAFF'], ['INSTRUCTOR']] as [Role][])(
    '%s may still edit and delete a row the student entered',
    async (role) => {
      const { service, tx } = setup({ enteredByRole: 'STUDENT' });
      await service.update('r1', { grade: 'A' } as never, user([role]));
      await service.remove('r1', user([role]));
      expect(tx.studentCourseRecord.update).toHaveBeenCalledTimes(2);
    },
  );
});
