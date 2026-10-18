import { UnauthorizedException } from '@nestjs/common';
import { EmailSignupRequest } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EmailSignupData,
  EmailSignupRequestService,
  SIGNUP_MAX_SENDS_PER_WINDOW,
  SIGNUP_RESEND_COOLDOWN_MS,
  hashToken,
} from './email-signup-request.service';

const data: EmailSignupData = {
  email: 'somchai.j@ku.th',
  passwordHash: 'bcrypt',
  fullName: 'Somchai J',
  studentCode: '6512345678',
  programId: 'p',
  curriculumId: 'c',
  admissionYear: 2568,
  privacyPolicyVersion: 'v1',
};

// In-memory stand-in for the email_signup_requests table.
function fakePrisma() {
  const rows: EmailSignupRequest[] = [];
  const matches = (row: EmailSignupRequest, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, cond]) => {
      const value = row[key as keyof EmailSignupRequest] as unknown;
      if (cond && typeof cond === 'object' && 'lt' in cond) {
        return (value as Date) < (cond as { lt: Date }).lt;
      }
      return value === cond;
    });
  const table = {
    findUnique: jest.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((r) => matches(r, where)) ?? null,
    ),
    create: jest.fn(async ({ data: d }: { data: Partial<EmailSignupRequest> }) => {
      const row = {
        id: `id-${rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...d,
      };
      rows.push(row as EmailSignupRequest);
      return row;
    }),
    update: jest.fn(
      async ({ where, data: d }: { where: { id: string }; data: Partial<EmailSignupRequest> }) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, d);
        return row;
      },
    ),
    deleteMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    }),
  };
  return { rows, prisma: { emailSignupRequest: table } };
}

function setup() {
  const { rows, prisma } = fakePrisma();
  const service = new EmailSignupRequestService(prisma as unknown as PrismaService);
  return { service, rows, prisma };
}

const at = (ms: number) => new Date(Date.UTC(2026, 9, 18) + ms);

describe('EmailSignupRequestService', () => {
  it('stores only the sha256 of the token it hands back', async () => {
    const { service, rows } = setup();
    const token = await service.upsert(data, at(0));
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].tokenHash).toBe(hashToken(token!));
    expect(rows[0].tokenHash).not.toBe(token);
  });

  it('finds a live request by its token and refuses it once expired (30 min)', async () => {
    const { service } = setup();
    const token = (await service.upsert(data, at(0)))!;
    await expect(service.findValidByToken(token, at(29 * 60_000))).resolves.toMatchObject({
      email: data.email,
    });
    await expect(service.findValidByToken(token, at(30 * 60_000))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.findValidByToken('not-a-token', at(0))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('signing up again replaces the token, so the older link stops working', async () => {
    const { service, rows } = setup();
    const first = (await service.upsert(data, at(0)))!;
    const second = (await service.upsert(data, at(SIGNUP_RESEND_COOLDOWN_MS)))!;
    expect(rows).toHaveLength(1);
    await expect(
      service.findValidByToken(first, at(SIGNUP_RESEND_COOLDOWN_MS)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.findValidByToken(second, at(SIGNUP_RESEND_COOLDOWN_MS)),
    ).resolves.toBeDefined();
  });

  it('sends at most one mail a minute per address', async () => {
    const { service } = setup();
    await service.upsert(data, at(0));
    await expect(service.upsert(data, at(SIGNUP_RESEND_COOLDOWN_MS - 1))).resolves.toBeNull();
    await expect(service.resend(data.email, at(SIGNUP_RESEND_COOLDOWN_MS - 1))).resolves.toBeNull();
    await expect(service.resend(data.email, at(SIGNUP_RESEND_COOLDOWN_MS))).resolves.not.toBeNull();
  });

  it(`caps an address at ${SIGNUP_MAX_SENDS_PER_WINDOW} mails per 24h, then opens a new window`, async () => {
    const { service } = setup();
    let now = 0;
    await service.upsert(data, at(now));
    for (let i = 1; i < SIGNUP_MAX_SENDS_PER_WINDOW; i++) {
      now += SIGNUP_RESEND_COOLDOWN_MS;
      await expect(service.resend(data.email, at(now))).resolves.not.toBeNull();
    }
    now += SIGNUP_RESEND_COOLDOWN_MS;
    await expect(service.resend(data.email, at(now))).resolves.toBeNull();
    await expect(service.upsert(data, at(now))).resolves.toBeNull();
    await expect(service.upsert(data, at(24 * 60 * 60_000 + 1))).resolves.not.toBeNull();
  });

  it('does not resend for an unknown address or an expired request', async () => {
    const { service } = setup();
    await expect(service.resend('nobody@ku.th', at(0))).resolves.toBeNull();
    await service.upsert(data, at(0));
    await expect(service.resend(data.email, at(31 * 60_000))).resolves.toBeNull();
  });

  it('keeps an expired row inside its send window, so waiting out the link does not reset the cap', async () => {
    const { service, rows } = setup();
    await service.upsert(data, at(0));
    await service.upsert({ ...data, email: 'other@ku.th' }, at(31 * 60_000));
    expect(rows.map((r) => r.email)).toContain(data.email);
  });

  it('consume works once: a second (or concurrent) use is refused', async () => {
    const { service, rows, prisma } = setup();
    const token = (await service.upsert(data, at(0)))!;
    const request = await service.findValidByToken(token, at(0));
    await service.consume(request, prisma as never);
    expect(rows).toHaveLength(0);
    await expect(service.consume(request, prisma as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deleteExpiredBefore removes only rows that expired before the cutoff and returns the count', async () => {
    const { service, rows } = setup();
    await service.upsert(data, at(0)); // expires at 30 min
    await service.upsert({ ...data, email: 'later@ku.th' }, at(60 * 60_000)); // expires at 90 min
    await expect(service.deleteExpiredBefore(at(31 * 60_000))).resolves.toBe(1);
    expect(rows.map((r) => r.email)).toEqual(['later@ku.th']);
    await expect(service.deleteExpiredBefore(at(31 * 60_000))).resolves.toBe(0);
  });
});
