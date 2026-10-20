import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { CourseService } from './course.service';

const staff: RequestUser = {
  userId: 'staff-1',
  email: 'staff@x.test',
  roles: ['STAFF'],
  mustChangePassword: false,
};

const COURSE = {
  id: 'c1',
  code: '01418111',
  name: 'วิชาหนึ่ง',
  nameEn: null,
  credits: 3,
  description: 'long text',
  isRequired: true,
  isActive: true,
  curriculumId: 'cur-1',
  categoryId: 'cat-1',
};

type Counts = Partial<{
  dependents: number;
  records: number;
  instructors: number;
  clos: number;
  assessments: number;
  plans: number;
  careers: number;
}>;

function setup(counts: Counts = {}, course: Partial<typeof COURSE> = {}) {
  const current = { ...COURSE, ...course };
  const tx = {
    prerequisite: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    course: {
      create: jest.fn(async ({ data }: { data: object }) => ({ ...COURSE, ...data, id: 'c-new' })),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...current, ...data })),
    },
    curriculum: { findUniqueOrThrow: jest.fn().mockResolvedValue({ programId: 'prog-1' }) },
  };
  const prisma = {
    course: {
      findUnique: jest.fn().mockResolvedValue(current),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    curriculum: { findUnique: jest.fn().mockResolvedValue({ id: 'cur-1', isActive: true }) },
    courseCategory: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'หมวด', isActive: true }),
    },
    prerequisite: { count: jest.fn().mockResolvedValue(counts.dependents ?? 0) },
    studentCourseRecord: { count: jest.fn().mockResolvedValue(counts.records ?? 0) },
    courseInstructor: { count: jest.fn().mockResolvedValue(counts.instructors ?? 0) },
    clo: { count: jest.fn().mockResolvedValue(counts.clos ?? 0) },
    courseAssessment: { count: jest.fn().mockResolvedValue(counts.assessments ?? 0) },
    studentPlannedCourse: { count: jest.fn().mockResolvedValue(counts.plans ?? 0) },
    careerCourse: { count: jest.fn().mockResolvedValue(counts.careers ?? 0) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const curriculumService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) };
  const categoryService = {
    findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'cat-2', curriculumId: 'cur-1' }),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new CourseService(
    prisma as never,
    curriculumService as never,
    categoryService as never,
    audit as never,
  );
  return { service, prisma, tx, audit, categoryService };
}

describe('CourseService.remove', () => {
  it('soft-deletes and clears its own prerequisites when nothing is attached', async () => {
    const { service, tx } = setup();
    await service.remove('c1', staff);
    expect(tx.prerequisite.deleteMany).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isActive: false },
    });
  });

  it('only counts active rows for models that have isActive', async () => {
    const { service, prisma } = setup();
    await service.remove('c1', staff);
    const active = { where: { courseId: 'c1', isActive: true } };
    expect(prisma.studentCourseRecord.count).toHaveBeenCalledWith(active);
    expect(prisma.clo.count).toHaveBeenCalledWith(active);
    expect(prisma.careerCourse.count).toHaveBeenCalledWith(active);
    expect(prisma.courseInstructor.count).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
    expect(prisma.courseAssessment.count).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
    expect(prisma.studentPlannedCourse.count).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
  });

  it.each<[string, Counts, string]>([
    ['a prerequisite of another course', { dependents: 1 }, 'วิชาบังคับก่อน'],
    ['a student course record', { records: 3 }, 'ผลการเรียนของนิสิต 3 รายการ'],
    ['an assigned instructor', { instructors: 1 }, 'อาจารย์ผู้สอน 1 รายการ'],
    ['a CLO', { clos: 2 }, 'CLO 2 รายการ'],
    ['a course assessment', { assessments: 1 }, 'การประเมินรายวิชา 1 รายการ'],
    ['a planned course', { plans: 4 }, 'แผนการเรียนของนิสิต 4 รายการ'],
    ['a career link', { careers: 2 }, 'การเชื่อมโยงกับอาชีพ 2 รายการ'],
  ])('rejects with a Thai 409 and keeps prerequisites when it has %s', async (_n, counts, text) => {
    const { service, prisma, tx, audit } = setup(counts);
    const error = await service.remove('c1', staff).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain(text);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.prerequisite.deleteMany).not.toHaveBeenCalled();
    expect(tx.course.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('lists every attached kind in one message', async () => {
    const { service } = setup({ records: 1, clos: 2 });
    await expect(service.remove('c1', staff)).rejects.toThrow(
      'ผลการเรียนของนิสิต 1 รายการ, CLO 2 รายการ',
    );
  });

  it('is a 404 for a course that is already deactivated', async () => {
    const { service, prisma } = setup({}, { isActive: false });
    await expect(service.remove('c1', staff)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records COURSE_DEACTIVATE in the same transaction, with the removed prerequisite count', async () => {
    const { service, tx, audit } = setup();
    await service.remove('c1', staff);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'COURSE_DEACTIVATE',
        actor: staff,
        targetType: 'Course',
        targetId: 'c1',
        studentProfileId: null,
        programId: 'prog-1',
        before: expect.objectContaining({ isActive: true }),
        after: expect.objectContaining({ isActive: false, removedPrerequisites: 2 }),
      }),
    );
  });
});

describe('CourseService.create / update audit', () => {
  it('records COURSE_CREATE with an allow-listed snapshot (no description)', async () => {
    const { service, tx, audit } = setup();
    await service.create(
      { code: 'X1', name: 'ใหม่', credits: 3, curriculumId: 'cur-1', categoryId: 'cat-2' },
      staff,
    );
    const entry = audit.record.mock.calls[0][1];
    expect(audit.record.mock.calls[0][0]).toBe(tx);
    expect(entry).toMatchObject({ action: 'COURSE_CREATE', targetId: 'c-new', before: null });
    expect(entry.after).toMatchObject({ code: 'X1', credits: 3, categoryId: 'cat-2' });
    expect(entry.after).not.toHaveProperty('description');
  });

  it('records COURSE_UPDATE with before and after, e.g. a category move', async () => {
    const { service, audit } = setup();
    await service.update('c1', { categoryId: 'cat-2' }, staff);
    const entry = audit.record.mock.calls[0][1];
    expect(entry.action).toBe('COURSE_UPDATE');
    expect(entry.before).toMatchObject({ categoryId: 'cat-1' });
    expect(entry.after).toMatchObject({ categoryId: 'cat-2' });
  });

  it('refuses to edit a deactivated course (404), writing nothing', async () => {
    const { service, prisma, audit } = setup({}, { isActive: false });
    await expect(service.update('c1', { name: 'x' }, staff)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('refuses a category of another curriculum', async () => {
    const { service, categoryService } = setup();
    categoryService.findActiveByIdOrThrow.mockResolvedValue({ id: 'cat-9', curriculumId: 'other' });
    await expect(service.update('c1', { categoryId: 'cat-9' }, staff)).rejects.toThrow(
      'does not belong to curriculum',
    );
  });
});

describe('CourseService.reactivate', () => {
  it('restores a deactivated course and records COURSE_REACTIVATE', async () => {
    const { service, tx, audit } = setup({}, { isActive: false });
    const result = await service.reactivate('c1', staff);
    expect(tx.course.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { isActive: true } });
    expect(result.isActive).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'COURSE_REACTIVATE',
        before: expect.objectContaining({ isActive: false }),
        after: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('is a 409 when the course is already active', async () => {
    const { service, prisma } = setup();
    await expect(service.reactivate('c1', staff)).rejects.toThrow('เปิดใช้งานอยู่แล้ว');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is a 409 while its curriculum is deactivated', async () => {
    const { service, prisma } = setup({}, { isActive: false });
    prisma.curriculum.findUnique.mockResolvedValue({ id: 'cur-1', isActive: false });
    await expect(service.reactivate('c1', staff)).rejects.toThrow('หลักสูตรของวิชานี้ปิดใช้งานอยู่');
  });

  it('is a 409 while its category is deactivated', async () => {
    const { service, prisma } = setup({}, { isActive: false });
    prisma.courseCategory.findUnique.mockResolvedValue({ id: 'cat-1', name: 'หมวด', isActive: false });
    await expect(service.reactivate('c1', staff)).rejects.toThrow('หมวดวิชา "หมวด" ปิดใช้งานอยู่');
  });

  it('is a 409 when an active course already uses the code', async () => {
    const { service, prisma } = setup({}, { isActive: false });
    prisma.course.findFirst.mockResolvedValue({ id: 'c2' });
    const error = await service.reactivate('c1', staff).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as Error).message).toContain('01418111');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('turns a racing duplicate (P2002) into the same 409', async () => {
    const { service, prisma } = setup({}, { isActive: false });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.reactivate('c1', staff)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('CourseService.findInactiveInCurricula', () => {
  it('keeps the caller curriculum filter and narrows to one curriculum when asked', async () => {
    const prisma = { course: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new CourseService(prisma as never, {} as never, {} as never, {} as never);
    const scope = { programId: { in: ['p1'] } };

    await service.findInactiveInCurricula(scope, 'cur-1');
    expect(prisma.course.findMany).toHaveBeenLastCalledWith({
      where: { isActive: false, curriculum: { AND: [scope, { id: 'cur-1' }] } },
      orderBy: { code: 'asc' },
    });

    await service.findInactiveInCurricula(scope);
    expect(prisma.course.findMany).toHaveBeenLastCalledWith({
      where: { isActive: false, curriculum: scope },
      orderBy: { code: 'asc' },
    });
  });
});
