import { NotFoundException } from '@nestjs/common';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { AcademicYearController } from './academic-year.controller';
import { AcademicYearService } from './academic-year.service';

function setup(opts: {
  year?: object | null;
  semesters?: { id: string; isActive: boolean }[];
  records?: number;
  assessments?: number;
  failYearDelete?: boolean;
}) {
  const semesters = (opts.semesters ?? [{ id: 's1', isActive: false }]).map((s) => ({
    ...s,
    academicYearId: 'y1',
  }));
  const academicYear = {
    findUnique: jest.fn().mockResolvedValue(
      opts.year === undefined ? { id: 'y1', year: 2699, isActive: false } : opts.year,
    ),
    delete: opts.failYearDelete
      ? jest.fn().mockRejectedValue(new Error('boom'))
      : jest.fn().mockResolvedValue({}),
  };
  const semester = {
    findMany: jest.fn().mockResolvedValue(semesters),
    deleteMany: jest.fn().mockResolvedValue({ count: semesters.length }),
  };
  const studentCourseRecord = {
    groupBy: jest
      .fn()
      .mockResolvedValue(opts.records ? [{ semesterId: 's1', _count: { _all: opts.records } }] : []),
  };
  const assessmentDefinition = {
    groupBy: jest
      .fn()
      .mockResolvedValue(
        opts.assessments ? [{ semesterId: 's1', _count: { _all: opts.assessments } }] : [],
      ),
  };
  const prisma = { academicYear, semester, studentCourseRecord, assessmentDefinition } as Record<
    string,
    unknown
  >;
  // Mimics a real transaction: a throw inside discards the writes made so far.
  const committed: string[] = [];
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const before = semester.deleteMany.mock.calls.length;
    try {
      return await fn(prisma);
    } catch (error) {
      if (semester.deleteMany.mock.calls.length > before) committed.push('rolled-back');
      throw error;
    }
  });
  return { service: new AcademicYearService(prisma as never), academicYear, semester, committed };
}

describe('AcademicYearService hardDelete', () => {
  it('deletes the semesters and then the year', async () => {
    const { service, semester, academicYear } = setup({});
    await service.hardDelete('y1', 'u1');
    expect(semester.deleteMany).toHaveBeenCalledWith({ where: { academicYearId: 'y1' } });
    expect(academicYear.delete).toHaveBeenCalledWith({ where: { id: 'y1' } });
  });

  it('404 when it does not exist', async () => {
    const { service } = setup({ year: null });
    await expect(service.hardDelete('y1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 while the year is still active', async () => {
    const { service, academicYear } = setup({ year: { id: 'y1', year: 2699, isActive: true } });
    await expect(service.hardDelete('y1', 'u1')).rejects.toThrow(/ปิดใช้งานแล้ว/);
    expect(academicYear.delete).not.toHaveBeenCalled();
  });

  it('409 when a semester under it is still active', async () => {
    const { service, semester } = setup({ semesters: [{ id: 's1', isActive: true }] });
    await expect(service.hardDelete('y1', 'u1')).rejects.toThrow(/ภาคเรียนที่ใช้งานอยู่ 1 ภาค/);
    expect(semester.deleteMany).not.toHaveBeenCalled();
  });

  it('409 with the counts when its semesters are referenced', async () => {
    const { service, semester, academicYear } = setup({ records: 4, assessments: 2 });
    await expect(service.hardDelete('y1', 'u1')).rejects.toThrow(
      /ผลการเรียน 4 รายการ และการประเมิน 2 รายการ/,
    );
    expect(semester.deleteMany).not.toHaveBeenCalled();
    expect(academicYear.delete).not.toHaveBeenCalled();
  });

  it('runs inside one transaction and rolls back when the year delete fails', async () => {
    const { service, committed } = setup({ failYearDelete: true });
    await expect(service.hardDelete('y1', 'u1')).rejects.toThrow('boom');
    expect(committed).toEqual(['rolled-back']);
  });
});

describe('AcademicYearService findInactive', () => {
  it('reports the references summed over the semesters of each year', async () => {
    const { service, academicYear } = setup({ records: 5, assessments: 1 });
    Object.assign(academicYear, {
      findMany: jest.fn().mockResolvedValue([{ id: 'y1', year: 2699, isActive: false }]),
    });
    const [row] = await service.findInactive();
    expect(row.references).toEqual({ activeSemesters: 0, records: 5, assessments: 1 });
  });
});

describe('AcademicYearController permanent delete', () => {
  it('is SUPER_ADMIN only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AcademicYearController.prototype.hardDelete)).toEqual([
      'SUPER_ADMIN',
    ]);
  });
});
