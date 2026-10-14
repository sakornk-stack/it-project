import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FacultyService } from './faculty/faculty.service';
import { DepartmentService } from './department/department.service';
import { ProgramService } from './program/program.service';

type Counts = Partial<
  Record<'departments' | 'programs' | 'curricula' | 'students' | 'invitations' | 'scopes', number>
>;

// One mocked client shared by the three services; count() answers per table + FK.
function setup(row: { isActive: boolean } | null, counts: Counts = {}, deleteError?: Error) {
  const record = row ? { id: 'x1', facultyId: 'f', departmentId: 'd', ...row } : null;
  const table = (key: keyof Counts) => ({ count: jest.fn().mockResolvedValue(counts[key] ?? 0) });
  const owner = (count: keyof Counts) => ({
    findUnique: jest.fn().mockResolvedValue(record),
    count: jest.fn().mockResolvedValue(counts[count] ?? 0),
    delete: deleteError
      ? jest.fn().mockRejectedValue(deleteError)
      : jest.fn().mockResolvedValue({}),
  });
  const prisma: Record<string, unknown> = {
    // count() on a table answers for the rows that table holds as children of its parent.
    faculty: owner('scopes'),
    department: owner('departments'),
    program: owner('programs'),
    curriculum: table('curricula'),
    studentProfile: table('students'),
    studentInvitation: table('invitations'),
    userScope: table('scopes'),
  };
  prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  const faculty = new FacultyService(prisma as never);
  const department = new DepartmentService(prisma as never, faculty);
  const program = new ProgramService(prisma as never, department);
  return { prisma, faculty, department, program };
}

const message = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    return (error as ConflictException).message;
  }
  throw new Error('expected a ConflictException');
};

describe('organisation permanent delete', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => warn.mockRestore());

  describe.each([
    ['faculty', 'คณะ', 'departments', 'ภาควิชา 2 รายการ'],
    ['department', 'ภาควิชา', 'programs', 'สาขา 2 รายการ'],
    ['program', 'สาขา', 'curricula', 'หลักสูตร 2 รายการ'],
  ] as const)('%s', (kind, thai, childKey, childText) => {
    it('deletes a deactivated, unreferenced record and logs only the id', async () => {
      const ctx = setup({ isActive: false });
      await ctx[kind].hardDelete('x1', 'admin-1');
      expect((ctx.prisma[kind] as { delete: jest.Mock }).delete).toHaveBeenCalledWith({
        where: { id: 'x1' },
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('x1');
      expect(warn.mock.calls[0][0]).toContain('admin-1');
    });

    it('is refused while still active', async () => {
      const ctx = setup({ isActive: true });
      expect(await message(ctx[kind].hardDelete('x1', 'a'))).toContain(`${thai}ที่ปิดใช้งานแล้ว`);
      expect((ctx.prisma[kind] as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
    });

    it('404s when missing', async () => {
      const ctx = setup(null);
      await expect(ctx[kind].hardDelete('x1', 'a')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('is blocked by children (even deactivated ones), with the count in Thai', async () => {
      const ctx = setup({ isActive: false }, { [childKey]: 2 });
      expect(await message(ctx[kind].hardDelete('x1', 'a'))).toContain(childText);
      expect((ctx.prisma[kind] as { delete: jest.Mock }).delete).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('is blocked by user scopes', async () => {
      const ctx = setup({ isActive: false }, { scopes: 3 });
      expect(await message(ctx[kind].hardDelete('x1', 'a'))).toContain(
        'ขอบเขตสิทธิ์ผู้ใช้ 3 รายการ',
      );
    });

    it('maps a concurrent insert (P2003) to 409', async () => {
      const p2003 = new Prisma.PrismaClientKnownRequestError('fk', {
        code: 'P2003',
        clientVersion: 'x',
      });
      const ctx = setup({ isActive: false }, {}, p2003);
      expect(await message(ctx[kind].hardDelete('x1', 'a'))).toContain('ระหว่างดำเนินการ');
    });
  });

  it('a program is also blocked by students and invitations', async () => {
    const ctx = setup({ isActive: false }, { students: 12, invitations: 1 });
    const text = await message(ctx.program.hardDelete('x1', 'a'));
    expect(text).toContain('นิสิต 12 คน');
    expect(text).toContain('คำเชิญนิสิต 1 รายการ');
  });

  it('findInactive adds the reference counts', async () => {
    const ctx = setup({ isActive: false }, { departments: 4 });
    (ctx.prisma.faculty as { findMany?: jest.Mock }).findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'x1', isActive: false }]);
    const rows = await ctx.faculty.findInactive();
    expect(rows[0].references).toEqual({ departments: 4, userScopes: 0 });
  });
});
