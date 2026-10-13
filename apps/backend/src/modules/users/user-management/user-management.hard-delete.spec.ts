import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { UserManagementService } from './user-management.service';
import { countUserReferences, userReferencesBlockMessage } from './user-references.util';

const TEST_EMAIL = 'someone@test.local';

function requester(userId: string, roles: Role[] = ['SUPER_ADMIN']): RequestUser {
  return { userId, email: 'sa@x.test', roles, mustChangePassword: false };
}

interface Setup {
  target?: {
    roles: Role[];
    isActive: boolean;
    studentProfile?: boolean;
  } | null;
  refs?: { instructors?: number; records?: number; invitations?: number };
  otherSuperAdmins?: number;
  failAt?: string;
  p2003?: boolean;
}

// A fake Prisma whose transaction stages its deletes and keeps them only when the
// callback finishes, so a throw leaves `committed` empty like a real rollback.
function setup(opts: Setup = {}) {
  const committed: string[] = [];
  const refs = opts.refs ?? {};
  const target =
    opts.target === null
      ? null
      : {
          id: 'target',
          email: TEST_EMAIL,
          isActive: opts.target?.isActive ?? false,
          userRoles: (opts.target?.roles ?? (['STAFF'] as Role[])).map((role) => ({ role })),
          studentProfile: opts.target?.studentProfile ? { id: 'sp' } : null,
        };

  const makeTx = (staged: string[]) => {
    const del = (name: string) =>
      jest.fn(async () => {
        if (opts.failAt === name) throw new Error('boom');
        staged.push(name);
        return { count: 1 };
      });
    return {
      courseInstructor: {
        groupBy: jest.fn(async () =>
          refs.instructors ? [{ userId: 'target', _count: { _all: refs.instructors } }] : [],
        ),
      },
      studentCourseRecord: {
        groupBy: jest.fn(async () =>
          refs.records ? [{ enteredByUserId: 'target', _count: { _all: refs.records } }] : [],
        ),
      },
      studentInvitation: {
        groupBy: jest.fn(async () =>
          refs.invitations
            ? [
                {
                  invitedByUserId: 'target',
                  _count: { _all: refs.invitations },
                },
              ]
            : [],
        ),
      },
      user: {
        count: jest.fn(async () => opts.otherSuperAdmins ?? 1),
        delete: del('user'),
      },
      pendingInvitation: { deleteMany: del('pendingInvitation') },
      passwordResetToken: { deleteMany: del('passwordResetToken') },
      twoFactorCredential: { deleteMany: del('twoFactorCredential') },
      userAuthMethod: { deleteMany: del('userAuthMethod') },
      googlePendingRegistration: { deleteMany: del('googlePending') },
      userScope: { deleteMany: del('userScope') },
      userRole: { deleteMany: del('userRole') },
    };
  };

  const prisma = {
    user: { findUnique: jest.fn(async () => target) },
    $transaction: jest.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      if (opts.p2003) {
        throw new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'x',
        });
      }
      const staged: string[] = [];
      const result = await fn(makeTx(staged));
      committed.push(...staged);
      return result;
    }),
  };
  const service = new UserManagementService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, prisma, committed };
}

const sa = requester('sa');

describe('UserManagementService.hardDelete', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('deletes a suspended staff account and its login data in one transaction', async () => {
    const { service, prisma, committed } = setup();
    await service.hardDelete('target', sa);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(committed).toEqual([
      'pendingInvitation',
      'passwordResetToken',
      'twoFactorCredential',
      'userAuthMethod',
      'googlePending',
      'userScope',
      'userRole',
      'user',
    ]);
  });

  it('logs the actor and counts, never the email or name', async () => {
    const { service } = setup();
    await service.hardDelete('target', sa);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('by user sa');
    expect(line).not.toContain(TEST_EMAIL);
    expect(line).not.toContain('test.local');
  });

  it('refuses your own account before any lookup', async () => {
    const { service, prisma } = setup();
    await expect(service.hardDelete('sa', sa)).rejects.toThrow('ไม่สามารถลบบัญชีของตัวเองได้');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('404 when the account does not exist', async () => {
    const { service } = setup({ target: null });
    await expect(service.hardDelete('target', sa)).rejects.toThrow(NotFoundException);
  });

  it.each([
    ['SUPER_ADMIN', ['SUPER_ADMIN'] as Role[], false],
    ['STUDENT role', ['STUDENT'] as Role[], false],
    ['a student profile', ['STAFF'] as Role[], true],
  ])('refuses %s with a Thai 403', async (_label, roles, studentProfile) => {
    const { service, committed } = setup({
      target: { roles, isActive: false, studentProfile },
    });
    await expect(service.hardDelete('target', sa)).rejects.toThrow(ForbiddenException);
    expect(committed).toEqual([]);
  });

  it('refuses an account that is still active (409)', async () => {
    const { service, committed } = setup({
      target: { roles: ['STAFF'], isActive: true },
    });
    const call = service.hardDelete('target', sa);
    await expect(call).rejects.toThrow(ConflictException);
    await expect(call).rejects.toThrow('ระงับการใช้งานแล้ว');
    expect(committed).toEqual([]);
  });

  it('409 with Thai counts for each kind of reference, and deletes nothing', async () => {
    const { service, committed } = setup({
      refs: { instructors: 2, records: 5, invitations: 3 },
    });
    const call = service.hardDelete('target', sa);
    await expect(call).rejects.toThrow(ConflictException);
    await expect(call).rejects.toThrow(/ผู้สอน 2 วิชา/);
    await expect(call).rejects.toThrow(/บันทึกผลการเรียน 5 รายการ/);
    await expect(call).rejects.toThrow(/ผู้เชิญนิสิต 3 รายการ/);
    expect(committed).toEqual([]);
  });

  it('409 when no other active SUPER_ADMIN would remain', async () => {
    const { service, committed } = setup({ otherSuperAdmins: 0 });
    await expect(service.hardDelete('target', sa)).rejects.toThrow('ผู้ดูแลระบบสูงสุด');
    expect(committed).toEqual([]);
  });

  it('maps a foreign-key error from a concurrent insert to 409', async () => {
    const { service } = setup({ p2003: true });
    await expect(service.hardDelete('target', sa)).rejects.toThrow(ConflictException);
  });

  it('rolls back when a step in the middle fails', async () => {
    const { service, committed } = setup({ failAt: 'userRole' });
    await expect(service.hardDelete('target', sa)).rejects.toThrow('boom');
    expect(committed).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('user references helpers', () => {
  it('counts per account and builds the Thai message with what to do first', async () => {
    const client = {
      courseInstructor: {
        groupBy: jest.fn(async () => [{ userId: 'a', _count: { _all: 2 } }]),
      },
      studentCourseRecord: {
        groupBy: jest.fn(async () => [
          { enteredByUserId: 'a', _count: { _all: 5 } },
          { enteredByUserId: null, _count: { _all: 9 } },
        ]),
      },
      studentInvitation: { groupBy: jest.fn(async () => []) },
    };
    const refs = (await countUserReferences(client as never, ['a', 'b'])).get('a')!;
    expect(refs).toEqual({
      courseInstructors: 2,
      enteredRecords: 5,
      studentInvitations: 0,
    });
    const message = userReferencesBlockMessage(refs);
    expect(message).toContain('ยังเป็นผู้สอน 2 วิชา');
    expect(message).toContain('เคยบันทึกผลการเรียน 5 รายการ');
    expect(message).toContain('ถอนการมอบหมายผู้สอน');
  });

  it('answers without a query when there are no ids', async () => {
    const client = { courseInstructor: { groupBy: jest.fn() } };
    expect((await countUserReferences(client as never, [])).size).toBe(0);
    expect(client.courseInstructor.groupBy).not.toHaveBeenCalled();
  });
});
