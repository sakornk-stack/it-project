import 'reflect-metadata';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { SCOPE_TARGET_KEY } from '../../../common/decorators/scope-target.decorator';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { PloController } from './plo.controller';
import { PloService } from './plo.service';

const admin: RequestUser = {
  userId: 'admin-1',
  email: 'admin@x.test',
  roles: ['ADMIN'],
  mustChangePassword: false,
};

const PLO = {
  id: 'plo-1',
  code: 'PLO1',
  name: 'ชื่อ',
  description: null,
  isActive: true,
  curriculumId: 'cur-1',
};

function setup(overrides: { mappings?: number; plo?: object | null } = {}) {
  const echo = (row: object) =>
    jest.fn(async (args: { data?: object }) => ({ ...row, ...(args?.data ?? {}) }));
  const tx = {
    plo: { create: echo(PLO), update: echo(PLO) },
    curriculum: { findUniqueOrThrow: jest.fn().mockResolvedValue({ programId: 'prog-1' }) },
  };
  const prisma = {
    plo: {
      findUnique: jest.fn().mockResolvedValue(overrides.plo === undefined ? PLO : overrides.plo),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cloPloMapping: { count: jest.fn().mockResolvedValue(overrides.mappings ?? 0) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const curriculumService = { findActiveByIdOrThrow: jest.fn().mockResolvedValue({}) };
  const service = new PloService(prisma as never, curriculumService as never, audit as never);
  return { service, prisma, tx, audit };
}

describe('PloService writes', () => {
  it('create audits PLO_CREATE with the program of the curriculum', async () => {
    const { service, tx, audit } = setup();
    await service.create({ code: 'PLO2', name: 'n', curriculumId: 'cur-1' }, admin);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'PLO_CREATE',
        targetType: 'Plo',
        programId: 'prog-1',
        before: null,
        after: expect.objectContaining({ code: 'PLO2' }),
      }),
    );
  });

  it('create refuses a code already used in the curriculum (409, Thai)', async () => {
    const { service, prisma, audit } = setup();
    prisma.plo.findFirst.mockResolvedValue({ id: 'other' });
    const error = await service
      .create({ code: 'PLO1', name: 'n', curriculumId: 'cur-1' }, admin)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('ถูกใช้แล้ว');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('update audits before and after', async () => {
    const { service, audit } = setup();
    await service.update('plo-1', { name: 'ใหม่' }, admin);
    const entry = audit.record.mock.calls[0][1];
    expect(entry.action).toBe('PLO_UPDATE');
    expect(entry.before.name).toBe('ชื่อ');
    expect(entry.after.name).toBe('ใหม่');
  });

  it('update and remove of a deactivated PLO are 404', async () => {
    const { service } = setup({ plo: { ...PLO, isActive: false } });
    await expect(service.update('plo-1', { name: 'x' }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('plo-1', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove deactivates and audits PLO_DEACTIVATE', async () => {
    const { service, tx, audit } = setup();
    await service.remove('plo-1', admin);
    expect(tx.plo.update).toHaveBeenCalledWith({
      where: { id: 'plo-1' },
      data: { isActive: false },
    });
    expect(audit.record.mock.calls[0][1].action).toBe('PLO_DEACTIVATE');
  });

  it('remove is blocked while CLO links exist, naming the count (409, Thai)', async () => {
    const { service, tx, audit } = setup({ mappings: 4 });
    const error = await service.remove('plo-1', admin).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('CLO 4 รายการ');
    expect(tx.plo.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('a failing audit write fails the change', async () => {
    const { service, audit } = setup();
    audit.record.mockRejectedValue(new Error('audit down'));
    await expect(service.update('plo-1', { name: 'z' }, admin)).rejects.toThrow('audit down');
  });

  it('findAllInCurricula narrows to the curriculum and the caller scope', async () => {
    const { service, prisma } = setup();
    await service.findAllInCurricula({ isActive: true }, 'cur-1');
    expect(prisma.plo.findMany).toHaveBeenCalledWith({
      where: { isActive: true, curriculumId: 'cur-1', curriculum: { isActive: true } },
    });
  });
});

describe('PLO write handlers are ADMIN + ScopeGuard', () => {
  const handlerOf = (method: string) =>
    (PloController.prototype as unknown as Record<string, object>)[method];

  it.each([
    ['create', 'curriculum', 'body', 'curriculumId'],
    ['update', 'plo', 'param', 'id'],
    ['remove', 'plo', 'param', 'id'],
  ])('%s targets %s from %s.%s', (method, entity, from, key) => {
    const handler = handlerOf(method);
    expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toContain(ScopeGuard);
    expect(Reflect.getMetadata(SCOPE_TARGET_KEY, handler)).toEqual({
      entity,
      source: { from, key },
    });
  });
});
