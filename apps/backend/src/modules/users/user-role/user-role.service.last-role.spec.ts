import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { LAST_ROLE_MESSAGE, UserRoleService } from './user-role.service';

function setup(held: Role[]) {
  const userRole = {
    findUnique: jest.fn(({ where }: { where: { userId_role: { role: Role } } }) =>
      Promise.resolve(
        held.includes(where.userId_role.role) ? { id: 'ur-1' } : null,
      ),
    ),
    count: jest.fn().mockResolvedValue(held.length),
    delete: jest.fn().mockResolvedValue({ id: 'ur-1' }),
  };
  const prisma = {
    $transaction: (fn: (tx: unknown) => unknown) => fn({ userRole }),
  };
  const service = new UserRoleService(
    prisma as unknown as PrismaService,
    {} as UserService,
  );
  return { service, userRole };
}

describe('UserRoleService.revokeRole — last role', () => {
  it('rejects with a Thai 409 when it is the only role left', async () => {
    const { service, userRole } = setup([Role.STAFF]);
    const result = service.revokeRole('u1', Role.STAFF);
    await expect(result).rejects.toThrow(ConflictException);
    await expect(result).rejects.toThrow(LAST_ROLE_MESSAGE);
    expect(userRole.delete).not.toHaveBeenCalled();
  });

  it('revokes one of several roles', async () => {
    const { service, userRole } = setup([Role.STAFF, Role.INSTRUCTOR]);
    await service.revokeRole('u1', Role.INSTRUCTOR);
    expect(userRole.delete).toHaveBeenCalledWith({ where: { id: 'ur-1' } });
  });

  it('still 404s when the user does not hold the role', async () => {
    const { service } = setup([Role.STAFF]);
    await expect(service.revokeRole('u1', Role.ADMIN)).rejects.toThrow(NotFoundException);
  });
});
