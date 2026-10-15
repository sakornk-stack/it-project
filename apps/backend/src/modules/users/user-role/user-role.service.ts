import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { UserService } from '../user/user.service';

export const LAST_ROLE_MESSAGE = 'ไม่สามารถถอดบทบาทสุดท้ายของผู้ใช้ได้';

@Injectable()
export class UserRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async assignRole(
    userId: string,
    role: Role,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    await this.userService.findById(userId, tx);

    try {
      return await tx.userRole.create({ data: { userId, role } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User ${userId} already has role ${role}`,
        );
      }
      throw error;
    }
  }

  // Used by StudentProfileService (and any future consumer) to check role
  // membership without reaching into the user_roles table directly.
  async hasRole(
    userId: string,
    role: Role,
    tx: PrismaClientOrTx = this.prisma,
  ): Promise<boolean> {
    const existing = await tx.userRole.findUnique({
      where: { userId_role: { userId, role } },
    });
    return existing !== null;
  }

  // Used by AuthService to build the roles claim of a JWT payload.
  async findRolesByUserId(
    userId: string,
    tx: PrismaClientOrTx = this.prisma,
  ): Promise<Role[]> {
    const userRoles = await tx.userRole.findMany({ where: { userId } });
    return userRoles.map((userRole) => userRole.role);
  }

  async revokeRole(userId: string, role: Role) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findUnique({
        where: { userId_role: { userId, role } },
      });
      if (!existing) {
        throw new NotFoundException(`User ${userId} does not have role ${role}`);
      }
      if ((await tx.userRole.count({ where: { userId } })) <= 1) {
        throw new ConflictException(LAST_ROLE_MESSAGE);
      }
      return tx.userRole.delete({ where: { id: existing.id } });
    });
  }
}
