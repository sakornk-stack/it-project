import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserService } from '../../users/user/user.service';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { JwtStrategy } from './jwt.strategy';

// Both strategies hand process.env.JWT_*_SECRET straight to passport-jwt when
// constructed, which throws without a secret. CI has no .env, so set fake,
// non-secret values for this file only and put the previous ones back after.
const FAKE_ENV = {
  JWT_ACCESS_SECRET: 'test-only-access-secret',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret',
};
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const [key, value] of Object.entries(FAKE_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const key of Object.keys(FAKE_ENV)) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const PAYLOAD = { sub: 'u1', email: 'a@b.c', roles: ['SUPER_ADMIN', 'ADMIN'] as never };

function service(result: unknown) {
  const findAuthContext = jest.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  const other = jest.fn();
  return {
    userService: { findAuthContext, findById: other } as unknown as UserService,
    findAuthContext,
    other,
  };
}

describe.each([
  ['JwtStrategy', (u: UserService) => new JwtStrategy(u)],
  [
    'JwtRefreshStrategy',
    // PAYLOAD carries no jti, so the revocation lookup is never reached here
    // (covered in auth.service.session.spec.ts).
    (u: UserService) => new JwtRefreshStrategy(u, {} as PrismaService),
  ],
])('%s', (_name, make) => {
  it('uses the roles stored in the database, not the ones in the token', async () => {
    const { userService } = service({ isActive: true, mustChangePassword: false, roles: ['STAFF'] });
    const user = await make(userService).validate(PAYLOAD);
    expect(user).toEqual({
      userId: 'u1',
      email: 'a@b.c',
      roles: ['STAFF'],
      mustChangePassword: false,
    });
  });

  it('a role revoked after the token was issued is gone on the next request', async () => {
    const first = service({ isActive: true, mustChangePassword: false, roles: ['ADMIN'] });
    const strategy = make(first.userService);
    expect((await strategy.validate(PAYLOAD)).roles).toEqual(['ADMIN']);
    first.findAuthContext.mockResolvedValueOnce({
      isActive: true,
      mustChangePassword: false,
      roles: [],
    } as never);
    expect((await strategy.validate(PAYLOAD)).roles).toEqual([]);
  });

  it('rejects a suspended account on its next request', async () => {
    const { userService } = service({ isActive: false, mustChangePassword: false, roles: ['ADMIN'] });
    await expect(make(userService).validate(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token whose account no longer exists as unauthorised, not 404', async () => {
    const { userService } = service(new NotFoundException());
    await expect(make(userService).validate(PAYLOAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('after a password change (tokenValidAfter)', () => {
    const changedAt = new Date('2026-10-21T10:00:00.000Z');
    const changedAtSec = changedAt.getTime() / 1000;
    const account = { isActive: true, mustChangePassword: false, roles: ['STAFF'] };

    it('rejects a token issued before the change', async () => {
      const { userService } = service({ ...account, tokenValidAfter: changedAt });
      await expect(
        make(userService).validate({ ...PAYLOAD, iat: changedAtSec - 1 }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('accepts a token issued in the same second or later', async () => {
      const { userService } = service({ ...account, tokenValidAfter: changedAt });
      const strategy = make(userService);
      await expect(strategy.validate({ ...PAYLOAD, iat: changedAtSec })).resolves.toBeDefined();
      await expect(strategy.validate({ ...PAYLOAD, iat: changedAtSec + 60 })).resolves.toBeDefined();
    });

    it('accepts any token when the password was never changed', async () => {
      const { userService } = service({ ...account, tokenValidAfter: null });
      await expect(make(userService).validate({ ...PAYLOAD, iat: 1 })).resolves.toBeDefined();
    });
  });

  it('asks the database once per request, through the one auth-context call', async () => {
    const { userService, findAuthContext, other } = service({
      isActive: true,
      mustChangePassword: true,
      roles: ['STUDENT'],
    });
    await make(userService).validate(PAYLOAD);
    expect(findAuthContext).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });
});
