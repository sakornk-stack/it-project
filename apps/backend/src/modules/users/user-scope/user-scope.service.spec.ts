import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { UserScopeService } from './user-scope.service';

const admin: RequestUser = {
  userId: 'a1',
  email: 'a@x.test',
  roles: ['ADMIN'],
  mustChangePassword: false,
};

function setup(targetRoles: Role[], ownScopeCoversAll = true) {
  const prisma = {
    userScope: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ facultyId: null, departmentId: null, programId: 'p1' }]),
      findUnique: jest.fn().mockResolvedValue({
        id: 's1',
        userId: 'target',
        facultyId: null,
        departmentId: null,
        programId: 'p1',
      }),
      delete: jest.fn().mockResolvedValue({}),
    },
    userRole: {
      findMany: jest.fn().mockResolvedValue(targetRoles.map((role) => ({ role }))),
    },
  };
  const resolver = {
    getEffectiveScopes: jest.fn().mockResolvedValue([]),
    isCovered: jest.fn().mockReturnValue(ownScopeCoversAll),
    resolveAncestryForLevel: jest
      .fn()
      .mockResolvedValue({ facultyId: null, departmentId: null, programId: 'p1' }),
    resolveScopeRowAncestry: jest.fn(
      async (s: { facultyId: string | null; departmentId: string | null; programId: string | null }) => ({
        facultyId: s.facultyId,
        departmentId: s.departmentId,
        programId: s.programId,
      }),
    ),
  };
  const userService = { findById: jest.fn().mockResolvedValue({ id: 'target' }) };
  const service = new UserScopeService(
    prisma as never,
    userService as never,
    {} as never,
    {} as never,
    {} as never,
    resolver as never,
  );
  const assign = jest.spyOn(service, 'assignScope').mockResolvedValue({} as never);
  const revokeScope = jest.spyOn(service, 'revokeScope').mockResolvedValue({} as never);
  return { service, assign, revokeScope };
}

describe('UserScopeService ADMIN target rule', () => {
  it('ADMIN cannot grant or revoke a scope on another ADMIN', async () => {
    const { service, assign, revokeScope } = setup(['ADMIN']);
    await expect(service.grantScope('target', 'PROGRAM', 'p1', admin)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.revoke('s1', admin)).rejects.toThrow(ForbiddenException);
    expect(assign).not.toHaveBeenCalled();
    expect(revokeScope).not.toHaveBeenCalled();
  });

  it('ADMIN can still remove their own scope from a STAFF user', async () => {
    const { service, revokeScope } = setup(['STAFF']);
    await service.revoke('s1', admin);
    expect(revokeScope).toHaveBeenCalledWith('s1');
  });

  it('SUPER_ADMIN may grant a scope to an ADMIN', async () => {
    const { service, assign } = setup(['ADMIN']);
    await service.grantScope('target', 'PROGRAM', 'p1', {
      ...admin,
      userId: 'sa',
      roles: ['SUPER_ADMIN'],
    });
    expect(assign).toHaveBeenCalled();
  });
});

describe('UserScopeService own-scope protection', () => {
  it.each(['SUPER_ADMIN', 'ADMIN'] as Role[])(
    '%s cannot revoke a scope that belongs to themselves (Thai 403)',
    async (role) => {
      const { service, revokeScope } = setup(['STAFF']);
      // The mocked scope row belongs to userId "target".
      const self = { ...admin, userId: 'target', roles: [role] };
      const call = service.revoke('s1', self);
      await expect(call).rejects.toThrow(ForbiddenException);
      await expect(call).rejects.toThrow('ขอบเขตของตัวเอง');
      expect(revokeScope).not.toHaveBeenCalled();
    },
  );

  it.each(['SUPER_ADMIN', 'ADMIN'] as Role[])(
    '%s cannot grant a scope to themselves (Thai 403)',
    async (role) => {
      const { service, assign } = setup(['STAFF']);
      const self = { ...admin, userId: 'target', roles: [role] };
      const call = service.grantScope('target', 'PROGRAM', 'p1', self);
      await expect(call).rejects.toThrow(ForbiddenException);
      await expect(call).rejects.toThrow('ขอบเขตของตัวเอง');
      expect(assign).not.toHaveBeenCalled();
    },
  );
});
