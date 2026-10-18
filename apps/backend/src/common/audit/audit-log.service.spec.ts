import { RequestUser } from '../../modules/auth/request-user.interface';
import { AuditLogService } from './audit-log.service';
import { actingRole, assertNoSecretKeys } from './audit-log.util';

const staff: RequestUser = {
  userId: 'staff-1',
  email: 'staff@x.test',
  roles: ['STAFF'],
  mustChangePassword: false,
};

describe('AuditLogService.record', () => {
  it('writes through the transaction client it is given, never its own', async () => {
    const prisma = { auditLog: { create: jest.fn() } };
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const service = new AuditLogService(prisma as never);

    await service.record(tx as never, {
      action: 'GRADE_UPDATE',
      actor: staff,
      targetType: 'StudentCourseRecord',
      targetId: 'rec-1',
      studentProfileId: 'sp-1',
      programId: 'p-1',
      before: { grade: 'B' },
      after: { grade: 'A' },
    });

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'GRADE_UPDATE',
        actorUserId: 'staff-1',
        actorRole: 'STAFF',
        targetId: 'rec-1',
        studentProfileId: 'sp-1',
        programId: 'p-1',
        before: { grade: 'B' },
        after: { grade: 'A' },
        reason: null,
      }),
    });
    // The actor's email never reaches the row.
    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain('staff@x.test');
  });

  it('refuses a snapshot with a secret or contact key and writes nothing', async () => {
    const tx = { auditLog: { create: jest.fn() } };
    const service = new AuditLogService({} as never);
    await expect(
      service.record(tx as never, {
        action: 'STUDENT_INVITATION_CANCEL',
        actor: staff,
        targetType: 'StudentInvitation',
        targetId: 'inv-1',
        studentProfileId: null,
        programId: 'p-1',
        before: { studentCode: '6600001', email: 'a@b.c' },
      }),
    ).rejects.toThrow('email');
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('AuditLogService.findForStudent', () => {
  it('names actors without their email, and null for an account deleted since', async () => {
    const createdAt = new Date('2026-10-18T08:00:00Z');
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            action: 'GRADE_CREATE',
            actorUserId: 'u1',
            actorRole: 'STAFF',
            targetId: 'r1',
            before: null,
            after: { grade: 'A' },
            reason: null,
            createdAt,
          },
          {
            id: 'a2',
            action: 'GRADE_DELETE',
            actorUserId: 'gone',
            actorRole: 'INSTRUCTOR',
            targetId: 'r2',
            before: { grade: 'F' },
            after: null,
            reason: null,
            createdAt,
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1', fullName: 'เจ้าหน้าที่ หนึ่ง' }]),
      },
    };
    const service = new AuditLogService(prisma as never);

    const result = await service.findForStudent('sp-1');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentProfileId: 'sp-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['u1', 'gone'] } },
      select: { id: true, fullName: true },
    });
    expect(result.map((r) => r.actorName)).toEqual(['เจ้าหน้าที่ หนึ่ง', null]);
    expect(result[0]).not.toHaveProperty('actorUserId');
  });
});

describe('assertNoSecretKeys', () => {
  it.each(['passwordHash', 'tokenHash', 'resetToken', 'secret', 'email'])('rejects %s', (key) => {
    expect(() => assertNoSecretKeys({ [key]: 'x' })).toThrow(key);
  });

  it('accepts the allow-listed snapshots', () => {
    expect(() =>
      assertNoSecretKeys({
        grade: 'A',
        courseId: 'c',
        semesterId: 's',
        studentCode: '66',
        profileActive: true,
      }),
    ).not.toThrow();
    expect(() => assertNoSecretKeys(null)).not.toThrow();
  });
});

describe('actingRole', () => {
  it('picks the most privileged role', () => {
    expect(actingRole(['INSTRUCTOR', 'STAFF'])).toBe('STAFF');
    expect(actingRole(['INSTRUCTOR'])).toBe('INSTRUCTOR');
    expect(actingRole(['STUDENT'])).toBe('STUDENT');
  });
});
