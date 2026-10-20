import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { SemesterController } from './semester.controller';
import { SemesterService } from './semester.service';

function setup(opts: { semester?: object | null; records?: number }) {
  const semester = {
    findUnique: jest.fn().mockResolvedValue(
      opts.semester === undefined
        ? { id: 's1', academicYearId: 'y1', term: 'FIRST', isActive: false }
        : opts.semester,
    ),
    delete: jest.fn().mockResolvedValue({}),
  };
  const studentCourseRecord = {
    groupBy: jest
      .fn()
      .mockResolvedValue(opts.records ? [{ semesterId: 's1', _count: { _all: opts.records } }] : []),
  };
  const prisma = { semester, studentCourseRecord } as Record<string, unknown>;
  prisma.$transaction = jest.fn((fn: (tx: unknown) => unknown) => fn(prisma));
  return { service: new SemesterService(prisma as never, {} as never), semester };
}

describe('SemesterService hardDelete', () => {
  it('deletes a deactivated, unreferenced semester', async () => {
    const { service, semester } = setup({});
    await service.hardDelete('s1', 'u1');
    expect(semester.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });

  it('404 when it does not exist', async () => {
    const { service } = setup({ semester: null });
    await expect(service.hardDelete('s1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 while it is still active', async () => {
    const { service, semester } = setup({
      semester: { id: 's1', academicYearId: 'y1', term: 'FIRST', isActive: true },
    });
    await expect(service.hardDelete('s1', 'u1')).rejects.toThrow(/ปิดใช้งานแล้ว/);
    expect(semester.delete).not.toHaveBeenCalled();
  });

  it('409 with the count when records reference it', async () => {
    const { service, semester } = setup({ records: 12 });
    await expect(service.hardDelete('s1', 'u1')).rejects.toThrow(/ผลการเรียน 12 รายการ/);
    expect(semester.delete).not.toHaveBeenCalled();
  });

  it('409 when a reference appears between the count and the delete (P2003)', async () => {
    const { service, semester } = setup({});
    semester.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }),
    );
    await expect(service.hardDelete('s1', 'u1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('SemesterController permanent delete', () => {
  it('is SUPER_ADMIN only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, SemesterController.prototype.hardDelete)).toEqual([
      'SUPER_ADMIN',
    ]);
  });
});
