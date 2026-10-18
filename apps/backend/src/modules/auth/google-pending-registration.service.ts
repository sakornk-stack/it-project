import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../prisma/prisma.types';

const PENDING_TOKEN_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class GooglePendingRegistrationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, googleId: string, fullName: string) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + PENDING_TOKEN_TTL_MS);

    await this.prisma.googlePendingRegistration.create({
      data: { tokenHash, email, googleId, fullName, expiresAt },
    });

    return token;
  }

  async findValidByToken(token: string, tx: PrismaClientOrTx = this.prisma) {
    const pending = await tx.googlePendingRegistration.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (!pending || pending.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Registration session expired or invalid — start over with Google sign-in',
      );
    }

    return pending;
  }

  // Periodic cleanup (ExpiredSignupCleanupService); returns only a count.
  async deleteExpiredBefore(cutoff: Date): Promise<number> {
    const { count } = await this.prisma.googlePendingRegistration.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
