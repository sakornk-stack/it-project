import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { TwoFactorService } from './two-factor.service';

jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const GOOD_PASSWORD = 'Correct-Pass1';
const GOOD_CODE = '123456';

function setup(overrides: Record<string, unknown> = {}, twoFactorEnabled = true) {
  const user = {
    id: 'u1',
    email: 'u@test.local',
    passwordHash: bcrypt.hashSync(GOOD_PASSWORD, 4),
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
    ...overrides,
  };
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data }));
  const twoFactor = {
    isEnabled: jest.fn().mockResolvedValue(twoFactorEnabled),
    verifyLoginCode: jest
      .fn()
      .mockImplementation((_id: string, code: string) => Promise.resolve(code === GOOD_CODE)),
  };
  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'a',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'r',
        'jwt.refreshExpiresIn': '7d',
        'jwt.twoFactorPendingSecret': 'p',
        'jwt.twoFactorPendingExpiresIn': '5m',
      })[key],
  };
  const service = new AuthService(
    { user: { update } } as unknown as PrismaService,
    {
      findByEmail: jest.fn().mockResolvedValue(user),
      findById: jest.fn().mockResolvedValue(user),
    } as unknown as UserService,
    {
      findRolesByUserId: jest.fn().mockResolvedValue([Role.STUDENT]),
    } as unknown as UserRoleService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as unknown as PasswordResetService,
    {} as never,
    twoFactor as unknown as TwoFactorService,
    new JwtService({}),
    config as unknown as ConfigService,
  );
  // Only the lockout writes (issueTokenPair may also stamp lastLoginAt).
  const lockoutWrites = () =>
    update.mock.calls.filter(([args]) => 'failedLoginAttempts' in args.data);
  return { service, update, twoFactor, lockoutWrites };
}

describe('2FA verify lockout / backoff', () => {
  it('counts a wrong code below the threshold without locking, with the usual 401', async () => {
    const { service, lockoutWrites } = setup({ failedLoginAttempts: 2 });
    await expect(service.verifyTwoFactorLogin('u1', '000000')).rejects.toThrow(
      new UnauthorizedException('Invalid verification code'),
    );
    expect(lockoutWrites()).toEqual([
      [{ where: { id: 'u1' }, data: { failedLoginAttempts: 3, lockedUntil: null } }],
    ]);
  });

  it('locks from the 5th wrong code with backoff 1, 2, 4, 8 capped at 15 minutes', async () => {
    const lockMinutes = async (prior: number) => {
      const { service, lockoutWrites } = setup({ failedLoginAttempts: prior });
      const before = Date.now();
      await expect(service.verifyTwoFactorLogin('u1', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
      const until: Date = lockoutWrites()[0][0].data.lockedUntil;
      return Math.round((until.getTime() - before) / 60_000);
    };
    expect(await lockMinutes(4)).toBe(1);
    expect(await lockMinutes(5)).toBe(2);
    expect(await lockMinutes(6)).toBe(4);
    expect(await lockMinutes(7)).toBe(8);
    expect(await lockMinutes(8)).toBe(15);
    expect(await lockMinutes(20)).toBe(15);
  });

  it('refuses a locked account even with the right code, same message, without checking the code', async () => {
    const { service, twoFactor, update } = setup({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60_000),
    });
    await expect(service.verifyTwoFactorLogin('u1', GOOD_CODE)).rejects.toThrow(
      new UnauthorizedException('Invalid verification code'),
    );
    // Not checked, so a recovery code is never consumed on a locked account.
    expect(twoFactor.verifyLoginCode).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('lets an expired lock through and resets the counters on a right code', async () => {
    const { service, lockoutWrites } = setup({
      failedLoginAttempts: 6,
      lockedUntil: new Date(Date.now() - 1000),
    });
    await expect(service.verifyTwoFactorLogin('u1', GOOD_CODE)).resolves.toHaveProperty(
      'accessToken',
    );
    expect(lockoutWrites()).toEqual([
      [{ where: { id: 'u1' }, data: { failedLoginAttempts: 0, lockedUntil: null } }],
    ]);
  });

  it('does not write lockout state on a clean right code', async () => {
    const { service, lockoutWrites } = setup();
    await service.verifyTwoFactorLogin('u1', GOOD_CODE);
    expect(lockoutWrites()).toHaveLength(0);
  });
});

describe('login with 2FA does not reset the lockout counter', () => {
  it('keeps the counter on a right password for a 2FA account (only a right code clears it)', async () => {
    const { service, lockoutWrites } = setup({ failedLoginAttempts: 4 });
    const result = await service.login({ email: 'u@test.local', password: GOOD_PASSWORD });
    expect(result).toHaveProperty('requiresTwoFactor', true);
    expect(lockoutWrites()).toHaveLength(0);
  });

  it('cannot be used to reset the code-guess budget: the 5th wrong code still locks', async () => {
    const { service, lockoutWrites } = setup({ failedLoginAttempts: 4 });
    await service.login({ email: 'u@test.local', password: GOOD_PASSWORD });
    await expect(service.verifyTwoFactorLogin('u1', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(lockoutWrites()[0][0].data.failedLoginAttempts).toBe(5);
    expect(lockoutWrites()[0][0].data.lockedUntil).toBeInstanceOf(Date);
  });

  it('still resets the counter on a right password for an account without 2FA', async () => {
    const { service, lockoutWrites } = setup({ failedLoginAttempts: 3 }, false);
    await expect(
      service.login({ email: 'u@test.local', password: GOOD_PASSWORD }),
    ).resolves.toHaveProperty('accessToken');
    expect(lockoutWrites()).toEqual([
      [{ where: { id: 'u1' }, data: { failedLoginAttempts: 0, lockedUntil: null } }],
    ]);
  });
});
