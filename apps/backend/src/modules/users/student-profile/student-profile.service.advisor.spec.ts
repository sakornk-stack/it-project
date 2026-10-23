import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '../../auth/request-user.interface';
import { UpdateStudentAdvisorDto } from './dto/update-student-advisor.dto';
import { StudentProfileService } from './student-profile.service';

const staff = { userId: 'staff-1', roles: ['STAFF'] } as unknown as RequestUser;
const ADVISOR_ID = 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const OTHER_ADVISOR_ID = 'c5e2d3f5-2345-4b6c-8d7e-8f9a0b1c2d3e';

const PROFILE = {
  id: 'sp1',
  userId: 'u1',
  programId: 'p1',
  isActive: true,
  advisorUserId: null as string | null,
};

function setup(
  opts: { profile?: Partial<typeof PROFILE> | null; advisorIsInstructor?: boolean } = {},
) {
  const profile = opts.profile === null ? null : { ...PROFILE, ...opts.profile };
  const tx = {
    studentProfile: {
      findUnique: jest.fn().mockResolvedValue(profile),
      update: jest.fn(async ({ data }: { data: { advisorUserId: string | null } }) => ({
        ...profile,
        ...data,
        advisor: data.advisorUserId ? { id: data.advisorUserId, fullName: 'อ.ที่ปรึกษา' } : null,
      })),
    },
    user: {
      findFirst: jest.fn(async () =>
        opts.advisorIsInstructor === false ? null : { id: ADVISOR_ID },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new StudentProfileService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    audit as never,
  );
  return { service, tx, audit };
}

describe('StudentProfileService.updateAdvisor', () => {
  it('sets an advisor and audits the ids before and after', async () => {
    const { service, tx, audit } = setup();
    const result = await service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff);

    expect(result).toEqual({ id: 'sp1', advisor: { id: ADVISOR_ID, fullName: 'อ.ที่ปรึกษา' } });
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: ADVISOR_ID, isActive: true, userRoles: { some: { role: 'INSTRUCTOR' } } },
      select: { id: true },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'STUDENT_ADVISOR_UPDATE',
        actor: staff,
        targetType: 'StudentProfile',
        targetId: 'sp1',
        studentProfileId: 'sp1',
        programId: 'p1',
        before: { advisorUserId: null },
        after: { advisorUserId: ADVISOR_ID },
      }),
    );
  });

  it('changes one advisor for another', async () => {
    const { service, audit } = setup({ profile: { advisorUserId: OTHER_ADVISOR_ID } });
    await service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff);
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        before: { advisorUserId: OTHER_ADVISOR_ID },
        after: { advisorUserId: ADVISOR_ID },
      }),
    );
  });

  it('clears the advisor without looking up a user', async () => {
    const { service, tx } = setup({ profile: { advisorUserId: ADVISOR_ID } });
    const result = await service.updateAdvisor('sp1', { advisorUserId: null }, staff);
    expect(result.advisor).toBeNull();
    expect(tx.user.findFirst).not.toHaveBeenCalled();
  });

  it('refuses a user who is not an active instructor, and writes nothing', async () => {
    const { service, tx, audit } = setup({ advisorIsInstructor: false });
    const call = service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff);
    await expect(call).rejects.toThrow(BadRequestException);
    await expect(call).rejects.toThrow('ไม่ใช่อาจารย์');
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses the student as their own advisor', async () => {
    const { service } = setup({ profile: { userId: ADVISOR_ID } });
    await expect(
      service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff),
    ).rejects.toThrow('ของตัวเอง');
  });

  it('answers 400 when the advisor is already the same', async () => {
    const { service, tx } = setup({ profile: { advisorUserId: ADVISOR_ID } });
    await expect(
      service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff),
    ).rejects.toThrow('ไม่มีข้อมูลที่เปลี่ยนแปลง');
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
  });

  it('answers 409 for a suspended student', async () => {
    const { service } = setup({ profile: { isActive: false } });
    await expect(
      service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff),
    ).rejects.toThrow(ConflictException);
  });

  it('answers 404 for a missing profile', async () => {
    const { service } = setup({ profile: null });
    await expect(
      service.updateAdvisor('sp1', { advisorUserId: ADVISOR_ID }, staff),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('UpdateStudentAdvisorDto', () => {
  const errorsFor = (body: object) => validate(plainToInstance(UpdateStudentAdvisorDto, body));

  it('accepts a uuid or null', async () => {
    expect(await errorsFor({ advisorUserId: ADVISOR_ID })).toHaveLength(0);
    expect(await errorsFor({ advisorUserId: null })).toHaveLength(0);
  });

  it('refuses a missing value or a non-uuid', async () => {
    expect(await errorsFor({})).not.toHaveLength(0);
    expect(await errorsFor({ advisorUserId: 'not-a-uuid' })).not.toHaveLength(0);
  });
});
