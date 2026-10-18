import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EmailSignupRequest, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClientOrTx } from '../../prisma/prisma.types';

export const SIGNUP_LINK_TTL_MINUTES = 30;
const SIGNUP_LINK_TTL_MS = SIGNUP_LINK_TTL_MINUTES * 60 * 1000;
// Anti-spam, per address and on top of the per-IP throttle: at most one mail
// a minute and five a day, however many IPs ask.
export const SIGNUP_RESEND_COOLDOWN_MS = 60 * 1000;
export const SIGNUP_MAX_SENDS_PER_WINDOW = 5;
const SIGNUP_SEND_WINDOW_MS = 24 * 60 * 60 * 1000;

export const INVALID_SIGNUP_LINK_MESSAGE =
  'ลิงก์ยืนยันหมดอายุหรือถูกใช้ไปแล้ว กรุณาสมัครหรือขอลิงก์ใหม่';

export interface EmailSignupData {
  email: string;
  passwordHash: string;
  fullName: string;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  privacyPolicyVersion: string;
}

// Email+password sign-ups waiting for mailbox proof (model comment in
// schema.prisma). Only the sha256 of a token is ever stored; the raw token is
// returned once, to be mailed, and never logged.
@Injectable()
export class EmailSignupRequestService {
  constructor(private readonly prisma: PrismaService) {}

  // Writes (or replaces) the request for data.email and returns a fresh raw
  // token to mail — or null when this address is in its cooldown or out of
  // sends for the day, in which case nothing changes and the link already
  // mailed stays the valid one.
  async upsert(data: EmailSignupData, now = new Date()): Promise<string | null> {
    await this.pruneStale(now);
    const existing = await this.prisma.emailSignupRequest.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      const budget = this.sendBudget(existing, now);
      if (!budget) return null;
      const token = newToken();
      await this.prisma.emailSignupRequest.update({
        where: { id: existing.id },
        data: { ...data, ...this.freshLink(token, now), ...budget },
      });
      return token;
    }
    const token = newToken();
    try {
      await this.prisma.emailSignupRequest.create({
        data: { ...data, ...this.freshLink(token, now), sendCount: 1, windowStartedAt: now },
      });
    } catch (error) {
      // Two sign-ups for one address at once: the other one wins and mails.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
    return token;
  }

  // New link for a request that is still live, under the same limits as upsert.
  async resend(email: string, now = new Date()): Promise<string | null> {
    const existing = await this.prisma.emailSignupRequest.findUnique({ where: { email } });
    if (!existing || existing.expiresAt <= now) return null;
    const budget = this.sendBudget(existing, now);
    if (!budget) return null;
    const token = newToken();
    await this.prisma.emailSignupRequest.update({
      where: { id: existing.id },
      data: { ...this.freshLink(token, now), ...budget },
    });
    return token;
  }

  async findValidByToken(token: string, now = new Date()): Promise<EmailSignupRequest> {
    const request = await this.prisma.emailSignupRequest.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!request || request.expiresAt <= now) {
      throw new UnauthorizedException(INVALID_SIGNUP_LINK_MESSAGE);
    }
    return request;
  }

  // Single use even under a race: only the call that actually deletes the row
  // (matching id AND the token it was found by) may go on to create the account.
  async consume(request: EmailSignupRequest, tx: PrismaClientOrTx): Promise<void> {
    const { count } = await tx.emailSignupRequest.deleteMany({
      where: { id: request.id, tokenHash: request.tokenHash },
    });
    if (count !== 1) throw new UnauthorizedException(INVALID_SIGNUP_LINK_MESSAGE);
  }

  // Next send's counters, or null when this address may not get a mail now.
  private sendBudget(existing: EmailSignupRequest, now: Date) {
    const inWindow = now.getTime() - existing.windowStartedAt.getTime() < SIGNUP_SEND_WINDOW_MS;
    const sent = inWindow ? existing.sendCount : 0;
    const coolingDown = now.getTime() - existing.lastSentAt.getTime() < SIGNUP_RESEND_COOLDOWN_MS;
    if (coolingDown || sent >= SIGNUP_MAX_SENDS_PER_WINDOW) return null;
    return { sendCount: sent + 1, windowStartedAt: inWindow ? existing.windowStartedAt : now };
  }

  private freshLink(token: string, now: Date) {
    return {
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + SIGNUP_LINK_TTL_MS),
      lastSentAt: now,
    };
  }

  // Expired rows whose daily send window is also over carry nothing worth
  // keeping; rows still inside the window are kept so the cap can't be reset
  // just by waiting for a link to expire.
  private async pruneStale(now: Date) {
    await this.prisma.emailSignupRequest.deleteMany({
      where: {
        expiresAt: { lt: now },
        windowStartedAt: { lt: new Date(now.getTime() - SIGNUP_SEND_WINDOW_MS) },
      },
    });
  }
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
