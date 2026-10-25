import { ConflictException, Injectable } from '@nestjs/common';
import { AuthProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../../prisma/prisma.types';
import { UserService } from '../user/user.service';

@Injectable()
export class UserAuthMethodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  // providerUserId is the external identity for the provider (e.g.
  // Google's "sub" claim) — null for PASSWORD, since the credential itself
  // lives on User.passwordHash, not here.
  async create(
    userId: string,
    provider: AuthProvider,
    providerUserId: string | null,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    await this.userService.findById(userId, tx);

    try {
      return await tx.userAuthMethod.create({
        data: { userId, provider, providerUserId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User ${userId} already has a ${provider} auth method, or this ${provider} account is already linked to another user`,
        );
      }
      throw error;
    }
  }

  // Used by AuthService.handleGoogleCallback() to refuse linking a second
  // Google identity to an account that already has one.
  async findByUserIdAndProvider(
    userId: string,
    provider: AuthProvider,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    return tx.userAuthMethod.findUnique({
      where: { userId_provider: { userId, provider } },
    });
  }

  // Used by AuthService.handleGoogleCallback() to check whether this exact
  // external identity (e.g. a specific Google account) is already linked
  // to any user — the authoritative "is this a returning login" signal,
  // via the same @@unique([provider, providerUserId]) constraint that
  // prevents one Google account from being linked to two users.
  async findByProviderAndProviderUserId(
    provider: AuthProvider,
    providerUserId: string,
    tx: PrismaClientOrTx = this.prisma,
  ) {
    return tx.userAuthMethod.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
    });
  }
}
