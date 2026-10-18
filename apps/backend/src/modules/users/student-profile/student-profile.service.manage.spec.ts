import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestUser } from '../../auth/request-user.interface';
import { UpdateStudentActiveStatusDto } from './dto/update-student-active-status.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { StudentProfileService } from './student-profile.service';

const staff = { userId: 'staff-1', roles: ['STAFF'] } as unknown as RequestUser;
const SOME_UUID = 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';

const PROFILE = {
  id: 'sp1',
  userId: 'u1',
  studentCode: '6600001',
  programId: 'p1',
  curriculumId: 'c1',
  admissionYear: 2025,
  isActive: true,
};

function setup(
  opts: {
    profile?: Partial<typeof PROFILE> | null;
    userActive?: boolean;
    newProgramCovered?: boolean;
    records?: number;
    assessments?: number;
    planned?: number;
  } = {},
) {
  const profile = opts.profile === null ? null : { ...PROFILE, ...opts.profile };
  const tx = {
    studentProfile: {
      findUnique: jest.fn(async (args: { include?: unknown }) =>
        profile && args.include
          ? { ...profile, user: { isActive: opts.userActive ?? profile.isActive } }
          : profile,
      ),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...profile, ...data })),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    studentCourseRecord: { count: jest.fn().mockResolvedValue(opts.records ?? 0) },
    courseAssessment: { count: jest.fn().mockResolvedValue(opts.assessments ?? 0) },
    studentPlannedCourse: {
      deleteMany: jest.fn().mockResolvedValue({ count: opts.planned ?? 0 }),
    },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const programService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) };
  const curriculumService = {
    findActiveByIdOrThrow: jest.fn(async (id: string) => ({
      id,
      programId: id === 'c2' ? 'p2' : 'p1',
    })),
  };
  const scopeResolver = {
    resolveAncestry: jest.fn(async (_e: string, id: string) => ({ programId: id })),
    getEffectiveScopes: jest.fn().mockResolvedValue([]),
    isCovered: jest.fn(() => opts.newProgramCovered ?? true),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new StudentProfileService(
    prisma as never,
    {} as never,
    programService as never,
    curriculumService as never,
    scopeResolver as never,
    audit as never,
  );
  return { service, tx, audit, scopeResolver };
}

describe('StudentProfileService.updateActiveStatus', () => {
  it('suspends sign-in and the directory status together, with the reason audited', async () => {
    const { service, tx, audit } = setup();
    await service.updateActiveStatus('sp1', { isActive: false, reason: '  ลาออก  ' }, staff);

    expect(tx.studentProfile.update).toHaveBeenCalledWith({
      where: { id: 'sp1' },
      data: { isActive: false },
    });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isActive: false } });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'STUDENT_SUSPEND',
        studentProfileId: 'sp1',
        programId: 'p1',
        before: { profileActive: true, userActive: true },
        after: { profileActive: false, userActive: false },
        reason: 'ลาออก',
      }),
    );
  });

  it('reactivates both switches', async () => {
    const { service, tx, audit } = setup({ profile: { isActive: false } });
    await service.updateActiveStatus('sp1', { isActive: true, reason: 'กลับมาเรียน' }, staff);
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isActive: true } });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'STUDENT_REACTIVATE' }),
    );
  });

  it('answers 409 in Thai when already in that state, and writes nothing', async () => {
    const { service, tx, audit } = setup();
    const call = service.updateActiveStatus('sp1', { isActive: true, reason: 'ทดสอบซ้ำ' }, staff);
    await expect(call).rejects.toBeInstanceOf(ConflictException);
    await expect(call).rejects.toThrow('เปิดใช้งานอยู่แล้ว');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('brings a pair that disagrees back in line and records it as it was', async () => {
    const { service, tx, audit } = setup({ userActive: false });
    await service.updateActiveStatus('sp1', { isActive: false, reason: 'ซ่อมสถานะ' }, staff);
    expect(tx.studentProfile.update).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ before: { profileActive: true, userActive: false } }),
    );
  });

  it('refuses a reason that is only spaces', async () => {
    const { service, audit } = setup();
    await expect(
      service.updateActiveStatus('sp1', { isActive: false, reason: '       ' }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('answers 404 for a missing profile', async () => {
    const { service } = setup({ profile: null });
    await expect(
      service.updateActiveStatus('sp9', { isActive: false, reason: 'ไม่พบนิสิต' }, staff),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StudentProfileService.update', () => {
  const reason = 'แก้ข้อมูลที่กรอกผิด';

  it('changes the admission year and audits only that field', async () => {
    const { service, tx, audit } = setup();
    await service.update('sp1', { admissionYear: 2026, reason }, staff);
    expect(tx.studentProfile.update).toHaveBeenCalledWith({
      where: { id: 'sp1' },
      data: { programId: 'p1', curriculumId: 'c1', admissionYear: 2026 },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'STUDENT_PROFILE_UPDATE',
        before: { admissionYear: 2025 },
        after: { admissionYear: 2026 },
        reason,
      }),
    );
  });

  it('moves to another program in scope, dropping planned courses outside the new curriculum', async () => {
    const { service, tx, audit, scopeResolver } = setup({ planned: 2 });
    await service.update('sp1', { programId: 'p2', curriculumId: 'c2', reason }, staff);
    expect(scopeResolver.resolveAncestry).toHaveBeenCalledWith('program', 'p2');
    expect(tx.studentPlannedCourse.deleteMany).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        programId: 'p2',
        before: { programId: 'p1', curriculumId: 'c1' },
        after: { programId: 'p2', curriculumId: 'c2', plannedCoursesRemoved: 2 },
      }),
    );
  });

  it('refuses a new program outside the requester scope with 403', async () => {
    const { service, tx } = setup({ newProgramCovered: false });
    await expect(
      service.update('sp1', { programId: 'p2', curriculumId: 'c2', reason }, staff),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
  });

  it('refuses a curriculum that does not belong to the program with 400', async () => {
    const { service, tx } = setup();
    await expect(
      service.update('sp1', { curriculumId: 'c2', reason }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
  });

  it('refuses a curriculum change while grades sit outside the new curriculum', async () => {
    const { service, tx } = setup({ records: 3, assessments: 1 });
    const call = service.update('sp1', { programId: 'p2', curriculumId: 'c2', reason }, staff);
    await expect(call).rejects.toBeInstanceOf(ConflictException);
    await expect(call).rejects.toThrow('ผลการเรียน 3 รายวิชา');
    expect(tx.studentPlannedCourse.deleteMany).not.toHaveBeenCalled();
    expect(tx.studentProfile.update).not.toHaveBeenCalled();
  });

  it('answers 400 when nothing changes', async () => {
    const { service } = setup();
    await expect(
      service.update('sp1', { admissionYear: 2025, reason }, staff),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 409 for a suspended student', async () => {
    const { service } = setup({ profile: { isActive: false } });
    await expect(
      service.update('sp1', { admissionYear: 2026, reason }, staff),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

// Mirrors the global ValidationPipe options in main.ts.
async function validationErrors(dtoClass: new () => object, body: Record<string, unknown>) {
  const errors = await validate(plainToInstance(dtoClass, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('student management DTOs', () => {
  it('never accept a student code', async () => {
    expect(
      await validationErrors(UpdateStudentProfileDto, {
        studentCode: '6600002',
        admissionYear: 2026,
        reason: 'แก้รหัสนิสิต',
      }),
    ).toEqual(['studentCode']);
  });

  it('accept a program/curriculum/year change with a reason', async () => {
    expect(
      await validationErrors(UpdateStudentProfileDto, {
        programId: SOME_UUID,
        curriculumId: SOME_UUID,
        admissionYear: 2026,
        reason: 'ย้ายสาขาตามคำร้อง',
      }),
    ).toEqual([]);
  });

  it.each([UpdateStudentProfileDto, UpdateStudentActiveStatusDto])(
    '%p requires a reason of at least 5 characters',
    async (dto) => {
      expect(await validationErrors(dto, { isActive: false, admissionYear: 2026 })).toContain(
        'reason',
      );
      expect(
        await validationErrors(dto, { isActive: false, admissionYear: 2026, reason: 'สั้น' }),
      ).toContain('reason');
    },
  );
});
