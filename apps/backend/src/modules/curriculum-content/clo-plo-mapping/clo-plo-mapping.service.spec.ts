import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { SCOPE_TARGET_KEY } from '../../../common/decorators/scope-target.decorator';
import { ScopeGuard } from '../../../common/guards/scope.guard';
import { RequestUser } from '../../auth/request-user.interface';
import { CloPloMappingController } from './clo-plo-mapping.controller';
import { CloPloMappingService } from './clo-plo-mapping.service';
import { CreateCloPloMappingDto } from './dto/create-clo-plo-mapping.dto';

const admin: RequestUser = {
  userId: 'admin-1',
  email: 'admin@x.test',
  roles: ['ADMIN'],
  mustChangePassword: false,
};

const MAPPING = { id: 'm-1', cloId: 'clo-1', ploId: 'plo-1', weight: 3, isActive: true };

function setup(
  overrides: { existing?: object | null; mapping?: object | null; ploCurriculum?: string } = {},
) {
  const echo = (row: object) =>
    jest.fn(async (args: { data?: object }) => ({ ...row, ...(args?.data ?? {}) }));
  const tx = {
    cloPloMapping: { create: echo(MAPPING), update: echo(MAPPING) },
    plo: { findUniqueOrThrow: jest.fn().mockResolvedValue({ curriculumId: 'cur-1' }) },
    curriculum: { findUniqueOrThrow: jest.fn().mockResolvedValue({ programId: 'prog-1' }) },
  };
  const prisma = {
    cloPloMapping: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.mapping === undefined ? MAPPING : overrides.mapping),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  // create() looks the pair up by its compound key; update/remove look up by id.
  prisma.cloPloMapping.findUnique.mockImplementation(
    async (args: { where: { id?: string; cloId_ploId?: object } }) =>
      args.where.cloId_ploId
        ? (overrides.existing ?? null)
        : overrides.mapping === undefined
          ? MAPPING
          : overrides.mapping,
  );
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const cloService = {
    findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'clo-1', courseId: 'course-1' }),
  };
  const ploService = {
    findActiveByIdOrThrow: jest.fn().mockResolvedValue({
      id: 'plo-1',
      curriculumId: overrides.ploCurriculum ?? 'cur-1',
    }),
  };
  const courseService = {
    findActiveByIdOrThrow: jest.fn().mockResolvedValue({ id: 'course-1', curriculumId: 'cur-1' }),
  };
  const service = new CloPloMappingService(
    prisma as never,
    cloService as never,
    ploService as never,
    courseService as never,
    audit as never,
  );
  return { service, prisma, tx, audit };
}

const DTO = { cloId: 'clo-1', ploId: 'plo-1', weight: 3 };

describe('CloPloMappingService writes', () => {
  it('create audits CLO_PLO_MAPPING_CREATE', async () => {
    const { service, tx, audit } = setup();
    await service.create(DTO, admin);
    expect(tx.cloPloMapping.create).toHaveBeenCalledWith({ data: DTO });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'CLO_PLO_MAPPING_CREATE',
        targetType: 'CloPloMapping',
        programId: 'prog-1',
        before: null,
        after: expect.objectContaining({ weight: 3 }),
      }),
    );
  });

  it('create refuses a CLO and PLO of different curricula (400, Thai)', async () => {
    const { service, tx, audit } = setup({ ploCurriculum: 'cur-other' });
    const error = await service.create(DTO, admin).catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toContain('หลักสูตรเดียวกัน');
    expect(tx.cloPloMapping.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('create refuses an active duplicate pair (409, Thai)', async () => {
    const { service, audit } = setup({ existing: MAPPING });
    const error = await service.create(DTO, admin).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('เชื่อมโยง');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('create brings back a removed pair with the new weight and audits REACTIVATE', async () => {
    const { service, tx, audit } = setup({ existing: { ...MAPPING, isActive: false, weight: 1 } });
    await service.create({ ...DTO, weight: 5 }, admin);
    expect(tx.cloPloMapping.create).not.toHaveBeenCalled();
    expect(tx.cloPloMapping.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { isActive: true, weight: 5 },
    });
    const entry = audit.record.mock.calls[0][1];
    expect(entry.action).toBe('CLO_PLO_MAPPING_REACTIVATE');
    expect(entry.before).toEqual(expect.objectContaining({ isActive: false, weight: 1 }));
    expect(entry.after).toEqual(expect.objectContaining({ isActive: true, weight: 5 }));
  });

  it('update records the old and new weight', async () => {
    const { service, audit } = setup();
    await service.update('m-1', { weight: 5 }, admin);
    const entry = audit.record.mock.calls[0][1];
    expect(entry.action).toBe('CLO_PLO_MAPPING_UPDATE');
    expect(entry.before.weight).toBe(3);
    expect(entry.after.weight).toBe(5);
  });

  it('update and remove of a removed mapping are 404', async () => {
    const { service } = setup({ mapping: { ...MAPPING, isActive: false } });
    await expect(service.update('m-1', { weight: 2 }, admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove('m-1', admin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove deactivates and audits CLO_PLO_MAPPING_DEACTIVATE', async () => {
    const { service, tx, audit } = setup();
    await service.remove('m-1', admin);
    expect(tx.cloPloMapping.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { isActive: false },
    });
    expect(audit.record.mock.calls[0][1].action).toBe('CLO_PLO_MAPPING_DEACTIVATE');
  });

  it('a failing audit write fails the change', async () => {
    const { service, audit } = setup();
    audit.record.mockRejectedValue(new Error('audit down'));
    await expect(service.remove('m-1', admin)).rejects.toThrow('audit down');
  });

  it('findAllInCurricula narrows to the curriculum through the PLO', async () => {
    const { service, prisma } = setup();
    await service.findAllInCurricula({ isActive: true }, 'cur-1');
    expect(prisma.cloPloMapping.findMany).toHaveBeenCalledWith({
      where: { isActive: true, plo: { curriculum: { isActive: true }, curriculumId: 'cur-1' } },
    });
  });
});

describe('weight range matches the achievement formula inputs', () => {
  // PLO % = sum(CLO % x weight) / sum(weight): a zero weight would drop the CLO and a sum of
  // zero gives no value, so weights are whole numbers 1-5 (CreateCloPloMappingDto).
  const { validateSync } = jest.requireActual('class-validator');
  const check = (weight: unknown) => {
    const dto = Object.assign(new CreateCloPloMappingDto(), {
      cloId: 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d',
      ploId: 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d',
      weight,
    });
    return validateSync(dto).length;
  };
  it.each([1, 3, 5])('accepts %s', (w) => expect(check(w)).toBe(0));
  it.each([0, 6, 2.5, '3', -1])('rejects %s', (w) => expect(check(w)).toBeGreaterThan(0));
});

describe('mapping write handlers are ADMIN + ScopeGuard', () => {
  const handlerOf = (method: string) =>
    (CloPloMappingController.prototype as unknown as Record<string, object>)[method];

  it.each([
    ['create', 'plo', 'body', 'ploId'],
    ['update', 'cloPloMapping', 'param', 'id'],
    ['remove', 'cloPloMapping', 'param', 'id'],
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
