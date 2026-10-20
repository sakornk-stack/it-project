import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { SCOPE_TARGET_KEY } from '../../../common/decorators/scope-target.decorator';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { ScopeResolverService } from '../../../common/scope/scope-resolver.service';
import { RequestUser } from '../../auth/request-user.interface';
import { CloController } from './clo.controller';
import { CloService } from './clo.service';

const admin: RequestUser = {
  userId: 'admin-1',
  email: 'admin@x.test',
  roles: ['ADMIN'],
  mustChangePassword: false,
};

const CLO = {
  id: 'clo-1',
  code: 'CLO1',
  description: 'desc',
  achievementThreshold: 70,
  isConfirmed: false,
  isActive: true,
  courseId: 'course-1',
};

function setup(overrides: { mappings?: number; scores?: number; clo?: object | null } = {}) {
  const echo = (row: object) =>
    jest.fn(async (args: { data?: object }) => ({ ...row, ...(args?.data ?? {}) }));
  const tx = {
    clo: { create: echo(CLO), update: echo(CLO) },
    course: { findUniqueOrThrow: jest.fn().mockResolvedValue({ curriculumId: 'cur-1' }) },
    curriculum: { findUniqueOrThrow: jest.fn().mockResolvedValue({ programId: 'prog-1' }) },
  };
  const prisma = {
    clo: {
      findUnique: jest.fn().mockResolvedValue(overrides.clo === undefined ? CLO : overrides.clo),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cloPloMapping: { count: jest.fn().mockResolvedValue(overrides.mappings ?? 0) },
    courseAssessmentCloScore: { count: jest.fn().mockResolvedValue(overrides.scores ?? 0) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const courseService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'course-1' }) };
  const service = new CloService(prisma as never, courseService as never, audit as never);
  return { service, prisma, tx, audit, courseService };
}

describe('CloService writes', () => {
  it('create writes the CLO and a CLO_CREATE audit row through the same transaction', async () => {
    const { service, tx, audit } = setup();
    await service.create({ code: 'CLO2', description: 'd', courseId: 'course-1' }, admin);
    expect(tx.clo.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'CLO_CREATE',
        targetType: 'Clo',
        targetId: 'clo-1',
        programId: 'prog-1',
        before: null,
        after: expect.objectContaining({ code: 'CLO2', isConfirmed: false }),
      }),
    );
  });

  it('create refuses a code already used in the course (409)', async () => {
    const { service, prisma, audit } = setup();
    prisma.clo.findFirst.mockResolvedValue({ id: 'other' });
    await expect(
      service.create({ code: 'CLO1', description: 'd', courseId: 'course-1' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('update records before and after, including the confirm flag', async () => {
    const { service, audit } = setup();
    await service.update('clo-1', { isConfirmed: true }, admin);
    const entry = audit.record.mock.calls[0][1];
    expect(entry.action).toBe('CLO_UPDATE');
    expect(entry.before.isConfirmed).toBe(false);
    expect(entry.after.isConfirmed).toBe(true);
  });

  it('update of a deactivated CLO is a 404', async () => {
    const { service, audit } = setup({ clo: { ...CLO, isActive: false } });
    await expect(service.update('clo-1', { code: 'X' }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('remove deactivates and audits CLO_DEACTIVATE', async () => {
    const { service, tx, audit } = setup();
    await service.remove('clo-1', admin);
    expect(tx.clo.update).toHaveBeenCalledWith({
      where: { id: 'clo-1' },
      data: { isActive: false },
    });
    expect(audit.record.mock.calls[0][1].action).toBe('CLO_DEACTIVATE');
  });

  it('remove is blocked by active PLO mappings, naming the count (409)', async () => {
    const { service, tx, audit } = setup({ mappings: 3 });
    await expect(service.remove('clo-1', admin)).rejects.toThrow(/PLO 3 รายการ/);
    expect(tx.clo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('remove is blocked by assessment scores (409)', async () => {
    const { service, tx } = setup({ scores: 2 });
    const error = await service.remove('clo-1', admin).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('คะแนนการประเมินรายวิชา 2 รายการ');
    expect(tx.clo.update).not.toHaveBeenCalled();
  });

  it('remove of an already deactivated CLO is a 404', async () => {
    const { service } = setup({ clo: { ...CLO, isActive: false } });
    await expect(service.remove('clo-1', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a failing audit write fails the change (same transaction)', async () => {
    const { service, audit } = setup();
    audit.record.mockRejectedValue(new Error('audit down'));
    await expect(service.update('clo-1', { code: 'Z' }, admin)).rejects.toThrow('audit down');
  });

  it('findAllInCurricula narrows to the course and the caller scope', async () => {
    const { service, prisma } = setup();
    await service.findAllInCurricula({ id: 'cur-1' }, 'course-1');
    expect(prisma.clo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, courseId: 'course-1', course: { curriculum: { id: 'cur-1' } } },
      }),
    );
  });
});

const handlerOf = (method: string) =>
  (CloController.prototype as unknown as Record<string, object>)[method];

describe('CLO write handlers are ADMIN + ScopeGuard', () => {
  it.each([
    ['create', 'course', 'body', 'courseId'],
    ['update', 'clo', 'param', 'id'],
    ['remove', 'clo', 'param', 'id'],
  ])('%s targets %s from %s.%s', (method, entity, from, key) => {
    const handler = handlerOf(method);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(ScopeGuard);
    expect(Reflect.getMetadata(SCOPE_TARGET_KEY, handler)).toEqual({
      entity,
      source: { from, key },
    });
  });

  it('the CLO list stays ADMIN and STUDENT only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, handlerOf('findAll'))).toEqual(['ADMIN', 'STUDENT']);
  });

  function run(scopes: { level: string; programId?: string }[]) {
    const resolver = new ScopeResolverService({} as never);
    jest
      .spyOn(resolver, 'resolveAncestry')
      .mockResolvedValue({ facultyId: 'f1', departmentId: 'd1', programId: 'p1' } as never);
    jest
      .spyOn(resolver, 'getEffectiveScopes')
      .mockResolvedValue(
        scopes.map((s) => ({
          facultyId: null,
          departmentId: null,
          programId: null,
          ...s,
        })) as never,
      );
    const guard = new ScopeGuard(new Reflector(), resolver);
    const context = {
      getHandler: () => handlerOf('update'),
      getClass: () => CloController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'u1', roles: ['ADMIN'] },
          params: { id: 'clo-1' },
          body: {},
        }),
      }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  }

  it('refuses an ADMIN scoped to another program (403)', async () => {
    await expect(run([{ level: 'PROGRAM', programId: 'p-other' }])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an ADMIN whose program scope covers the CLO', async () => {
    await expect(run([{ level: 'PROGRAM', programId: 'p1' }])).resolves.toBe(true);
  });
});
