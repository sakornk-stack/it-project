import { NotFoundException } from '@nestjs/common';
import { RequestUser } from './request-user.interface';
import { StudentInvitationService } from './student-invitation.service';

const staff = { userId: 'staff-1', roles: ['STAFF'] } as unknown as RequestUser;

const INVITATION = {
  id: 'inv-1',
  tokenHash: 'a'.repeat(64),
  email: 'invitee@x.test',
  fullName: 'ผู้ถูกเชิญ ทดสอบ',
  studentCode: '6600001',
  programId: 'p1',
  curriculumId: 'c1',
  admissionYear: 2026,
  invitedByUserId: 'staff-0',
  expiresAt: new Date('2026-10-25T00:00:00Z'),
  createdAt: new Date('2026-10-18T00:00:00Z'),
};

function setup(opts: { found?: boolean; deleted?: number; auditFails?: boolean } = {}) {
  const tx = {
    studentInvitation: {
      findUnique: jest.fn().mockResolvedValue(opts.found === false ? null : INVITATION),
      deleteMany: jest.fn().mockResolvedValue({ count: opts.deleted ?? 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    studentInvitation: { deleteMany: jest.fn() },
  };
  const audit = {
    record: opts.auditFails
      ? jest.fn().mockRejectedValue(new Error('audit write failed'))
      : jest.fn().mockResolvedValue(undefined),
  };
  const service = new StudentInvitationService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    audit as never,
  );
  return { service, prisma, tx, audit };
}

describe('StudentInvitationService.cancel', () => {
  it('deletes the invitation and records the audit row in the same transaction', async () => {
    const { service, prisma, tx, audit } = setup();
    await service.cancel('inv-1', staff);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.studentInvitation.deleteMany).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(prisma.studentInvitation.deleteMany).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'STUDENT_INVITATION_CANCEL',
        actor: staff,
        targetId: 'inv-1',
        studentProfileId: null,
        programId: 'p1',
        before: {
          studentCode: '6600001',
          programId: 'p1',
          curriculumId: 'c1',
          admissionYear: 2026,
          expiresAt: '2026-10-25T00:00:00.000Z',
        },
      }),
    );
  });

  it('keeps the email, name and token hash out of the audit row', async () => {
    const { service, audit } = setup();
    await service.cancel('inv-1', staff);
    const written = JSON.stringify(audit.record.mock.calls[0][1]);
    expect(written).not.toContain(INVITATION.email);
    expect(written).not.toContain(INVITATION.fullName);
    expect(written).not.toContain(INVITATION.tokenHash);
  });

  it('answers 404 for a missing invitation and records nothing', async () => {
    const { service, audit } = setup({ found: false, deleted: 0 });
    await expect(service.cancel('inv-x', staff)).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('answers 404 when a sign-up consumed it in the meantime', async () => {
    const { service, audit } = setup({ deleted: 0 });
    await expect(service.cancel('inv-1', staff)).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('fails the whole transaction when the audit row cannot be written', async () => {
    const { service } = setup({ auditFails: true });
    await expect(service.cancel('inv-1', staff)).rejects.toThrow('audit write failed');
  });
});
