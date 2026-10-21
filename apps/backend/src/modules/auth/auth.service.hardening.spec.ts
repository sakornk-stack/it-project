import { NotFoundException, UnauthorizedException } from '@nestjs/common';
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
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const REFRESH_SECRET = 'test-refresh-secret';
const GOOD = 'Correct-Pass1';

function setup(overrides: Record<string, unknown> = {}) {
  const user = {
    id: 'u1',
    email: 'u@test.local',
    passwordHash: bcrypt.hashSync(GOOD, 4),
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
    ...overrides,
  };
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data }));
  const prisma = { user: { update } };
  const userService = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
  };
  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'a',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': REFRESH_SECRET,
        'jwt.refreshExpiresIn': '7d',
      })[key],
  };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    userService as unknown as UserService,
    { findRolesByUserId: jest.fn().mockResolvedValue([Role.STUDENT]) } as unknown as UserRoleService,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as unknown as PasswordResetService,
    {} as never,
    { isEnabled: jest.fn().mockResolvedValue(false) } as unknown as TwoFactorService,
    new JwtService({}),
    config as unknown as ConfigService,
  );
  return { service, update, user, userService };
}

const login = (service: AuthService, password: string) =>
  service.login({ email: 'u@test.local', password });

describe('login lockout / backoff', () => {
  it('counts failures below the threshold without locking', async () => {
    const { service, update } = setup({ failedLoginAttempts: 2 });
    await expect(login(service, 'wrong')).rejects.toThrow(UnauthorizedException);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 3, lockedUntil: null },
    });
  });

  it('locks from the 5th failure with exponential backoff capped at 15 minutes', async () => {
    const lockMinutes = async (prior: number) => {
      const { service, update } = setup({ failedLoginAttempts: prior });
      const before = Date.now();
      await expect(login(service, 'wrong')).rejects.toThrow(UnauthorizedException);
      const until: Date = update.mock.calls[0][0].data.lockedUntil;
      return Math.round((until.getTime() - before) / 60_000);
    };
    expect(await lockMinutes(4)).toBe(1);
    expect(await lockMinutes(5)).toBe(2);
    expect(await lockMinutes(6)).toBe(4);
    expect(await lockMinutes(20)).toBe(15);
  });

  it('rejects a locked account even with the right password, with the generic message', async () => {
    const { service, update } = setup({ lockedUntil: new Date(Date.now() + 60_000) });
    await expect(login(service, GOOD)).rejects.toThrow('Invalid email or password');
    expect(update).not.toHaveBeenCalled();
  });

  it('lets an expired lock through and resets the counters on success', async () => {
    const { service, update } = setup({
      failedLoginAttempts: 6,
      lockedUntil: new Date(Date.now() - 1000),
    });
    await expect(login(service, GOOD)).resolves.toHaveProperty('accessToken');
    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  it('does not write on a clean successful login', async () => {
    const { service, update } = setup();
    await login(service, GOOD);
    expect(update).not.toHaveBeenCalled();
  });
});

describe('login timing does not reveal whether the account exists', () => {
  // Every failure path must spend exactly one bcrypt compare: a path that
  // skips it answers measurably faster and gives the case away.
  let compare: jest.SpyInstance;
  beforeEach(() => {
    compare = jest.spyOn(bcrypt, 'compare');
  });
  afterEach(() => compare.mockRestore());

  it('unknown email: one compare, against a hash that is not any user\'s', async () => {
    const { service, userService, user } = setup();
    userService.findByEmail.mockRejectedValue(new NotFoundException());
    await expect(login(service, GOOD)).rejects.toThrow('Invalid email or password');
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).not.toBe(user.passwordHash);
  });

  it('Google-only account (no password): one compare, same message', async () => {
    const { service } = setup({ passwordHash: null });
    await expect(login(service, GOOD)).rejects.toThrow('Invalid email or password');
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('locked account: one compare, never against its real hash', async () => {
    const { service, user } = setup({ lockedUntil: new Date(Date.now() + 60_000) });
    await expect(login(service, GOOD)).rejects.toThrow('Invalid email or password');
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).not.toBe(user.passwordHash);
  });

  it('wrong password: one compare, against the real hash', async () => {
    const { service, user } = setup();
    await expect(login(service, 'wrong')).rejects.toThrow('Invalid email or password');
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toBe(user.passwordHash);
  });
});

describe('changePassword revokes all sessions', () => {
  it('stamps tokenValidAfter (floored to the second), clears lockout and returns a fresh token', async () => {
    const { service, update } = setup({ failedLoginAttempts: 3 });
    const result = await service.changePassword('u1', {
      oldPassword: GOOD,
      newPassword: 'New-Passw0rd',
    });
    const data = update.mock.calls[0][0].data;
    expect(data.tokenValidAfter).toBeInstanceOf(Date);
    expect(data.tokenValidAfter.getTime() % 1000).toBe(0);
    expect(data).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null });
    expect(result.refreshToken).toEqual(expect.any(String));
  });
});

describe('lastLoginAt', () => {
  const stamped = (update: jest.Mock) =>
    update.mock.calls.filter(([args]) => 'lastLoginAt' in args.data);

  it('is stamped on a successful password login of an active account', async () => {
    const { service, update } = setup({ isActive: true });
    await login(service, GOOD);
    expect(stamped(update)).toHaveLength(1);
    expect(stamped(update)[0][0]).toEqual({
      where: { id: 'u1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('is stamped after the 2FA step too', async () => {
    const { service, update } = setup({ isActive: true });
    await service.completeTwoFactorLogin('u1');
    expect(stamped(update)).toHaveLength(1);
  });

  it('is not stamped for a suspended account, nor for a failed login', async () => {
    const suspended = setup({ isActive: false });
    await login(suspended.service, GOOD);
    expect(stamped(suspended.update)).toHaveLength(0);

    const wrong = setup({ isActive: true });
    await expect(login(wrong.service, 'wrong')).rejects.toThrow(UnauthorizedException);
    expect(stamped(wrong.update)).toHaveLength(0);
  });

  it('is not stamped by a password change or a token refresh', async () => {
    const { service, update } = setup({ isActive: true });
    await service.changePassword('u1', { oldPassword: GOOD, newPassword: 'New-Passw0rd' });
    await service.refreshAccessToken('u1');
    expect(stamped(update)).toHaveLength(0);
  });
});

describe('JwtRefreshStrategy tokenValidAfter', () => {
  function strategy(tokenValidAfter: Date | null) {
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
    return new JwtRefreshStrategy(
      {
        findAuthContext: jest.fn().mockResolvedValue({
          isActive: true,
          roles: [Role.STUDENT],
          mustChangePassword: false,
          tokenValidAfter,
        }),
      } as unknown as UserService,
      {} as PrismaService,
    );
  }
  const payload = (iat: number) => ({ sub: 'u1', email: 'u@test.local', roles: [] as never, iat });
  const cutoff = new Date(1_700_000_000_000);

  it('rejects a token issued before the cutoff', async () => {
    await expect(strategy(cutoff).validate(payload(1_699_999_999))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a token issued at or after the cutoff, or when none is set', async () => {
    await expect(strategy(cutoff).validate(payload(1_700_000_000))).resolves.toBeDefined();
    await expect(strategy(null).validate(payload(1))).resolves.toBeDefined();
  });
});
