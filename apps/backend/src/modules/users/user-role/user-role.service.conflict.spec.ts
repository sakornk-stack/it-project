import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { STUDENT_SUPER_ADMIN_CONFLICT_MESSAGE, UserRoleService } from './user-role.service';

function setup(held: Role[]) {
  const userRole = {
    findFirst: jest.fn(({ where }: { where: { role: { in: Role[] } } }) =>
      Promise.resolve(where.role.in.some((r) => held.includes(r)) ? { id: 'ur-1' } : null),
    ),
    create: jest.fn().mockResolvedValue({ id: 'ur-new' }),
  };
  const userService = { findById: jest.fn().mockResolvedValue({ id: 'u1' }) };
  const service = new UserRoleService(
    { userRole } as unknown as PrismaService,
    userService as unknown as UserService,
  );
  return { service, userRole };
}

describe('UserRoleService.assignRole — STUDENT and SUPER_ADMIN never on one account', () => {
  it('refuses STUDENT for an account that already holds SUPER_ADMIN', async () => {
    const { service, userRole } = setup([Role.SUPER_ADMIN]);
    const result = service.assignRole('u1', Role.STUDENT);
    await expect(result).rejects.toThrow(ConflictException);
    await expect(result).rejects.toThrow(STUDENT_SUPER_ADMIN_CONFLICT_MESSAGE);
    expect(userRole.create).not.toHaveBeenCalled();
  });

  it('refuses SUPER_ADMIN for an account that already holds STUDENT', async () => {
    const { service, userRole } = setup([Role.STUDENT]);
    await expect(service.assignRole('u1', Role.SUPER_ADMIN)).rejects.toThrow(
      STUDENT_SUPER_ADMIN_CONFLICT_MESSAGE,
    );
    expect(userRole.create).not.toHaveBeenCalled();
  });

  it('grants STUDENT to an account without SUPER_ADMIN', async () => {
    const { service, userRole } = setup([]);
    await service.assignRole('u1', Role.STUDENT);
    expect(userRole.create).toHaveBeenCalledWith({ data: { userId: 'u1', role: Role.STUDENT } });
  });

  it('leaves other roles alone (no extra lookup)', async () => {
    const { service, userRole } = setup([Role.STUDENT]);
    await service.assignRole('u1', Role.STAFF);
    expect(userRole.findFirst).not.toHaveBeenCalled();
    expect(userRole.create).toHaveBeenCalled();
  });
});
