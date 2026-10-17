import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RequestUser } from '../../auth/request-user.interface';
import { UserManagementService } from './user-management.service';

const requester = (...roles: Role[]) =>
  ({ userId: 'me', roles, mustChangePassword: false }) as unknown as RequestUser;

function setup(targetRoles: Role[]) {
  const userService = {
    findOneWhere: jest.fn().mockResolvedValue({
      id: 'target',
      email: 't@x.test',
      fullName: 'T',
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      scopes: [],
      userRoles: targetRoles.map((role) => ({ role })),
    }),
  };
  const scopeResolver = { buildUserScopeOrFilter: jest.fn().mockResolvedValue([]) };
  const service = new UserManagementService(
    { user: { findMany: jest.fn().mockResolvedValue([]) } } as never,
    userService as never,
    {} as never,
    {} as never,
    scopeResolver as never,
    {} as never,
    {} as never,
  );
  return service;
}

describe('UserManagementService.getOne — SUPER_ADMIN and student accounts', () => {
  it('does not hand a student account to SUPER_ADMIN (same as the list)', async () => {
    const service = setup(['STUDENT']);
    await expect(service.getOne('target', requester('SUPER_ADMIN'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('still returns a staff account to SUPER_ADMIN', async () => {
    const service = setup(['STAFF']);
    await expect(service.getOne('target', requester('SUPER_ADMIN'))).resolves.toMatchObject({
      id: 'target',
    });
  });

  it('leaves the ADMIN path to its scope filter', async () => {
    const service = setup(['STAFF']);
    await expect(service.getOne('target', requester('ADMIN'))).resolves.toMatchObject({
      id: 'target',
    });
  });
});
