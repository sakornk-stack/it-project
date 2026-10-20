import { ConflictException } from '@nestjs/common';
import { CourseService } from './course.service';

type Counts = Partial<{
  dependents: number;
  records: number;
  instructors: number;
  clos: number;
  assessments: number;
  plans: number;
}>;

function setup(counts: Counts = {}) {
  const tx = {
    prerequisite: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    course: { update: jest.fn().mockResolvedValue({ id: 'c1', isActive: false }) },
  };
  const prisma = {
    course: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', isActive: true }) },
    prerequisite: { count: jest.fn().mockResolvedValue(counts.dependents ?? 0) },
    studentCourseRecord: { count: jest.fn().mockResolvedValue(counts.records ?? 0) },
    courseInstructor: { count: jest.fn().mockResolvedValue(counts.instructors ?? 0) },
    clo: { count: jest.fn().mockResolvedValue(counts.clos ?? 0) },
    courseAssessment: { count: jest.fn().mockResolvedValue(counts.assessments ?? 0) },
    studentPlannedCourse: { count: jest.fn().mockResolvedValue(counts.plans ?? 0) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const service = new CourseService(prisma as never, {} as never, {} as never);
  return { service, prisma, tx };
}

describe('CourseService.remove', () => {
  it('soft-deletes and clears its own prerequisites when nothing is attached', async () => {
    const { service, tx } = setup();
    await service.remove('c1');
    expect(tx.prerequisite.deleteMany).toHaveBeenCalledWith({ where: { courseId: 'c1' } });
    expect(tx.course.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isActive: false },
    });
  });

  it('only counts active rows for models that have isActive', async () => {
    const { service, prisma } = setup();
    await service.remove('c1');
    const active = { where: { courseId: 'c1', isActive: true } };
    expect(prisma.studentCourseRecord.count).toHaveBeenCalledWith(active);
    expect(prisma.clo.count).toHaveBeenCalledWith(active);
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
  ])('rejects with a Thai 409 and keeps prerequisites when it has %s', async (_n, counts, text) => {
    const { service, prisma, tx } = setup(counts);
    const error = await service.remove('c1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toContain(text);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.prerequisite.deleteMany).not.toHaveBeenCalled();
    expect(tx.course.update).not.toHaveBeenCalled();
  });

  it('lists every attached kind in one message', async () => {
    const { service } = setup({ records: 1, clos: 2 });
    await expect(service.remove('c1')).rejects.toThrow(
      'ผลการเรียนของนิสิต 1 รายการ, CLO 2 รายการ',
    );
  });
});
