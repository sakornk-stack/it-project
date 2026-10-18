import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';

function emailEquals(email: string): Prisma.UserWhereInput {
  return { email: { equals: email.trim(), mode: 'insensitive' } };
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    email: string,
    passwordHash: string | null,
    fullName: string,
    tx: PrismaClientOrTx = this.prisma,
    mustChangePassword = false,
  ) {
    // Case-insensitive: "A@ku.th" and "a@ku.th" are one mailbox, so they must
    // never become two accounts (users.email itself is a plain unique column).
    const existing = await tx.user.findFirst({ where: emailEquals(email), select: { id: true } });
    if (existing) {
      throw new ConflictException(`Email "${email}" is already in use`);
    }
    return tx.user.create({
      data: { email, passwordHash, fullName, mustChangePassword },
    });
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findFirst({ where: emailEquals(email) });
    if (!user) {
      throw new NotFoundException(`User with email "${email}" not found`);
    }
    return user;
  }

  async findById(id: string, tx: PrismaClientOrTx = this.prisma) {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  // What the JWT strategies need on every request: the account and its roles as
  // they are in the database right now, in one call. The token's own `roles`
  // claim is never trusted for authorisation, so a role that was revoked (or
  // granted) takes effect on the very next request.
  async findAuthContext(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { select: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const { userRoles, ...account } = user;
    return { ...account, roles: userRoles.map((userRole) => userRole.role) };
  }

  // Generic passthrough — the caller (UserManagementService) builds the
  // `where` clause, including any scope-containment filter, so this stays
  // a thin single-entity service per CONVENTIONS.md §6. `omit`/`include`
  // are here (not left to the caller) because every caller of this method
  // is Module 12's admin-facing listing — passwordHash must never leave
  // this layer, and roles/scopes are what the admin UI needs to render a
  // row without an extra request per user.
  async findAll(where: Prisma.UserWhereInput) {
    return this.prisma.user.findMany({
      where,
      omit: { passwordHash: true },
      include: { userRoles: true, scopes: true },
    });
  }

  // Same query-level filter contract as findAll — used by UserManagementService
  // to enforce "exists but outside your scope" as a 404, not a 403 (§3a:
  // User is personal data, unlike Faculty/Department).
  async findOneWhere(where: Prisma.UserWhereInput) {
    const user = await this.prisma.user.findFirst({
      where,
      omit: { passwordHash: true },
      include: { userRoles: true, scopes: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setActiveStatus(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      omit: { passwordHash: true },
    });
  }
}
