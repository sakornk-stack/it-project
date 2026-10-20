import { RequestUser } from '../auth/request-user.interface';
import { CourseCategoryService } from './course-category/course-category.service';
import { CurriculumRequirementService } from './curriculum-requirement/curriculum-requirement.service';
import { PrerequisiteService } from './prerequisite/prerequisite.service';

// Every STAFF write to the curriculum catalogue leaves one audit row, written
// through the same transaction client as the change (CONVENTIONS §11).
const staff: RequestUser = {
  userId: 'staff-1',
  email: 'staff@x.test',
  roles: ['STAFF'],
  mustChangePassword: false,
};

const CATEGORY = { id: 'cat-1', name: 'หมวด', code: null, curriculumId: 'cur-1', isActive: true };
const REQUIREMENT = {
  id: 'req-1',
  curriculumId: 'cur-1',
  categoryId: 'cat-1',
  minCredits: 30,
  minCourses: null,
};
const PREREQ = { id: 'pre-1', courseId: 'c1', prerequisiteCourseId: 'c0', groupId: null };

function makeTx() {
  const echo = (row: object) =>
    jest.fn(async (args: { data?: object }) => ({ ...row, ...(args?.data ?? {}) }));
  return {
    courseCategory: { create: echo(CATEGORY), update: echo(CATEGORY) },
    curriculumRequirement: {
      create: echo(REQUIREMENT),
      update: echo(REQUIREMENT),
      delete: echo(REQUIREMENT),
    },
    prerequisite: { create: echo(PREREQ), update: echo(PREREQ), delete: echo(PREREQ) },
    course: { findUniqueOrThrow: jest.fn().mockResolvedValue({ curriculumId: 'cur-1' }) },
    curriculum: { findUniqueOrThrow: jest.fn().mockResolvedValue({ programId: 'prog-1' }) },
  };
}

function base(tx: ReturnType<typeof makeTx>) {
  return {
    courseCategory: {
      findUnique: jest.fn().mockResolvedValue(CATEGORY),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    course: { count: jest.fn().mockResolvedValue(0) },
    curriculumRequirement: { findUnique: jest.fn().mockResolvedValue(REQUIREMENT) },
    prerequisite: { findUnique: jest.fn().mockResolvedValue(PREREQ) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
}

function setup() {
  const tx = makeTx();
  const prisma = base(tx);
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const curriculumService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) };
  const categoryService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue(CATEGORY) };
  const courseService = {
    findActiveByIdOrThrow: jest.fn(async (id: string) => ({ id, curriculumId: 'cur-1' })),
  };
  return {
    tx,
    audit,
    category: new CourseCategoryService(
      prisma as never,
      curriculumService as never,
      audit as never,
    ),
    requirement: new CurriculumRequirementService(
      prisma as never,
      curriculumService as never,
      categoryService as never,
      audit as never,
    ),
    prerequisite: new PrerequisiteService(prisma as never, courseService as never, audit as never),
  };
}

type Run = (s: ReturnType<typeof setup>) => Promise<unknown>;

const CASES: [string, Run, string, string, 'none' | 'both' | 'before' | 'after'][] = [
  [
    'category create',
    (s) => s.category.create({ name: 'หมวด', curriculumId: 'cur-1' }, staff),
    'COURSE_CATEGORY_CREATE',
    'CourseCategory',
    'after',
  ],
  [
    'category update',
    (s) => s.category.update('cat-1', { name: 'ใหม่' }, staff),
    'COURSE_CATEGORY_UPDATE',
    'CourseCategory',
    'both',
  ],
  [
    'category deactivate',
    (s) => s.category.remove('cat-1', staff),
    'COURSE_CATEGORY_DEACTIVATE',
    'CourseCategory',
    'both',
  ],
  [
    'requirement create',
    (s) =>
      s.requirement.create({ curriculumId: 'cur-1', categoryId: 'cat-1', minCredits: 30 }, staff),
    'CURRICULUM_REQUIREMENT_CREATE',
    'CurriculumRequirement',
    'after',
  ],
  [
    'requirement update',
    (s) => s.requirement.update('req-1', { minCredits: 24 }, staff),
    'CURRICULUM_REQUIREMENT_UPDATE',
    'CurriculumRequirement',
    'both',
  ],
  [
    'requirement delete',
    (s) => s.requirement.remove('req-1', staff),
    'CURRICULUM_REQUIREMENT_DELETE',
    'CurriculumRequirement',
    'before',
  ],
  [
    'prerequisite create',
    (s) => s.prerequisite.create({ courseId: 'c1', prerequisiteCourseId: 'c0' }, staff),
    'PREREQUISITE_CREATE',
    'Prerequisite',
    'after',
  ],
  [
    'prerequisite update',
    (s) => s.prerequisite.update('pre-1', { groupId: 'g1' }, staff),
    'PREREQUISITE_UPDATE',
    'Prerequisite',
    'both',
  ],
  [
    'prerequisite delete',
    (s) => s.prerequisite.remove('pre-1', staff),
    'PREREQUISITE_DELETE',
    'Prerequisite',
    'before',
  ],
];

describe('curriculum catalogue writes are audited', () => {
  it.each(CASES)('%s', async (_name, run, action, targetType, snapshots) => {
    const s = setup();
    await run(s);
    expect(s.audit.record).toHaveBeenCalledTimes(1);
    const [tx, entry] = s.audit.record.mock.calls[0];
    expect(tx).toBe(s.tx);
    expect(entry).toMatchObject({
      action,
      actor: staff,
      targetType,
      studentProfileId: null,
      programId: 'prog-1',
    });
    expect(entry.before === null || entry.before === undefined).toBe(snapshots === 'after');
    expect(entry.after === null || entry.after === undefined).toBe(snapshots === 'before');
  });

  it('a category snapshot carries the new values after an update', async () => {
    const s = setup();
    await s.category.update('cat-1', { name: 'ใหม่' }, staff);
    const entry = s.audit.record.mock.calls[0][1];
    expect(entry.before).toMatchObject({ name: 'หมวด' });
    expect(entry.after).toMatchObject({ name: 'ใหม่' });
  });

  it('a blocked category deactivate writes no audit row', async () => {
    const tx = makeTx();
    const prisma = { ...base(tx), course: { count: jest.fn().mockResolvedValue(2) } };
    const audit = { record: jest.fn() };
    const service = new CourseCategoryService(prisma as never, {} as never, audit as never);
    await expect(service.remove('cat-1', staff)).rejects.toThrow('active course');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('requirement update keeps the requirement in its own curriculum', async () => {
    const s = setup();
    await s.requirement.update('req-1', { minCredits: 24 }, staff);
    expect(s.tx.curriculumRequirement.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { minCredits: 24 },
    });
  });
});
