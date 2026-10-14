import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { AuthService } from './auth.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import { PasswordResetService } from './password-reset.service';
import { PendingInvitationService } from './pending-invitation.service';
import { StudentInvitationService } from './student-invitation.service';
import { TwoFactorService } from './two-factor.service';
import { RequestUser } from './request-user.interface';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

// two-factor.service imports otplib (ESM-only deps Jest can't parse); the
// token-issuing paths under test never touch 2FA.
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const ACCESS_SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';
const user = { id: 'user-1', email: 'u@test.local' };

// In-memory stand-in for the revoked_refresh_tokens table.
function fakePrisma() {
  const rows = new Map<string, { jti: string; expiresAt: Date }>();
  return {
    rows,
    revokedRefreshToken: {
      findUnique: jest.fn(({ where }: { where: { jti: string } }) =>
        Promise.resolve(rows.get(where.jti) ?? null),
      ),
      upsert: jest.fn(({ create }: { create: { jti: string; expiresAt: Date } }) => {
        if (!rows.has(create.jti)) rows.set(create.jti, create);
        return Promise.resolve(create);
      }),
      deleteMany: jest.fn(({ where }: { where: { expiresAt: { lt: Date } } }) => {
        for (const [jti, row] of rows) {
          if (row.expiresAt < where.expiresAt.lt) rows.delete(jti);
        }
        return Promise.resolve({ count: 0 });
      }),
    },
  };
}

function setup(sessionMaxHours: number | undefined = 8) {
  const prisma = fakePrisma();
  const jwtService = new JwtService({});
  const userService = {
    findById: jest.fn().mockResolvedValue(user),
    findAuthContext: jest.fn().mockResolvedValue({
      isActive: true,
      roles: [Role.STUDENT],
      mustChangePassword: false,
    }),
  };
  const userRoleService = {
    findRolesByUserId: jest.fn().mockResolvedValue([Role.STUDENT]),
  };
  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': ACCESS_SECRET,
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': REFRESH_SECRET,
        'jwt.refreshExpiresIn': '7d',
        'session.absoluteMaxHours': sessionMaxHours,
      })[key],
  };
  const unused = {};
  const service = new AuthService(
    prisma as unknown as PrismaService,
    userService as unknown as UserService,
    userRoleService as unknown as UserRoleService,
    unused as unknown as UserAuthMethodService,
    unused as unknown as StudentProfileService,
    unused as unknown as GooglePendingRegistrationService,
    unused as unknown as PendingInvitationService,
    unused as unknown as StudentInvitationService,
    unused as unknown as PasswordResetService,
    unused as unknown as EmailService,
    unused as unknown as TwoFactorService,
    jwtService,
    config as unknown as ConfigService,
  );
  process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
  const strategy = new JwtRefreshStrategy(
    userService as unknown as UserService,
    prisma as unknown as PrismaService,
  );
  return { service, strategy, prisma, jwtService };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('authTime on first-login token issuance', () => {
  // Every first-token path (password login, 2FA verify, Google callback,
  // Google registration completion, register) funnels through
  // issueTokenPair; completeTwoFactorLogin is its thinnest public entry.
  it('stamps authTime (now) on both tokens and a unique jti on the refresh token', async () => {
    const { service, jwtService } = setup();
    const before = nowSeconds();
    const a = await service.completeTwoFactorLogin(user.id);
    const b = await service.completeTwoFactorLogin(user.id);

    const access = jwtService.decode(a.accessToken) as Record<string, number>;
    const refresh = jwtService.decode(a.refreshToken) as Record<string, number | string>;
    expect(access.authTime).toBeGreaterThanOrEqual(before);
    expect(access.authTime).toBeLessThanOrEqual(nowSeconds());
    expect(refresh.authTime).toBe(access.authTime);
    expect(typeof refresh.jti).toBe('string');
    const refreshB = jwtService.decode(b.refreshToken) as Record<string, string>;
    expect(refreshB.jti).not.toBe(refresh.jti);
  });
});

describe('AuthService.refreshAccessToken', () => {
  it('keeps the original authTime — refresh never extends the cap', async () => {
    const { service, jwtService } = setup();
    const authTime = nowSeconds() - 3 * 3600;
    const { accessToken } = await service.refreshAccessToken(user.id, authTime);
    const decoded = jwtService.decode(accessToken) as Record<string, number>;
    expect(decoded.authTime).toBe(authTime);
  });

  it('rejects with a Thai 401 once SESSION_ABSOLUTE_MAX_HOURS has passed', async () => {
    const { service } = setup(8);
    const authTime = nowSeconds() - (8 * 3600 + 5);
    const attempt = service.refreshAccessToken(user.id, authTime);
    await expect(attempt).rejects.toThrow(UnauthorizedException);
    await expect(attempt).rejects.toThrow('เซสชันมีอายุครบกำหนดสูงสุด กรุณาเข้าสู่ระบบอีกครั้ง');
  });

  it('still allows a refresh just inside the cap', async () => {
    const { service } = setup(8);
    const authTime = nowSeconds() - (8 * 3600 - 60);
    await expect(service.refreshAccessToken(user.id, authTime)).resolves.toHaveProperty(
      'accessToken',
    );
  });

  it('falls back to the default 8h when the configured value is missing', async () => {
    const { service } = setup(undefined);
    await expect(service.refreshAccessToken(user.id, nowSeconds() - 9 * 3600)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(
      service.refreshAccessToken(user.id, nowSeconds() - 7 * 3600),
    ).resolves.toHaveProperty('accessToken');
  });
});

describe('JwtRefreshStrategy.validate', () => {
  it('uses the claim authTime when present', async () => {
    const { strategy } = setup();
    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      roles: [Role.STUDENT],
      authTime: 1000,
      iat: 2000,
    });
    expect(result.authTime).toBe(1000);
  });

  it('falls back to iat for legacy tokens that have no authTime', async () => {
    const { strategy } = setup();
    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      roles: [Role.STUDENT],
      iat: 2000,
    });
    expect(result.authTime).toBe(2000);
  });
});

describe('logout revocation', () => {
  const claims = (jti: string, exp: number) => ({
    sub: user.id,
    email: user.email,
    roles: [Role.STUDENT],
    authTime: nowSeconds(),
    jti,
    exp,
  });

  it('revokes the refresh token for real: it is rejected after logout', async () => {
    const { service, strategy } = setup();
    const exp = nowSeconds() + 3600;

    const principal = await strategy.validate(claims('jti-1', exp));
    expect(principal.refreshJti).toBe('jti-1');
    expect(principal.refreshExp).toBe(exp);

    await service.revokeRefreshToken(principal as RequestUser);

    await expect(strategy.validate(claims('jti-1', exp))).rejects.toThrow(UnauthorizedException);
    // A different session of the same user is untouched.
    await expect(strategy.validate(claims('jti-2', exp))).resolves.toBeDefined();
  });

  it('is idempotent and prunes rows whose token has already expired', async () => {
    const { service, prisma } = setup();
    prisma.rows.set('old', {
      jti: 'old',
      expiresAt: new Date(Date.now() - 1000),
    });
    const principal = {
      userId: user.id,
      email: user.email,
      roles: [Role.STUDENT],
      mustChangePassword: false,
      refreshJti: 'jti-3',
      refreshExp: nowSeconds() + 3600,
    };
    await service.revokeRefreshToken(principal);
    await service.revokeRefreshToken(principal);
    expect([...prisma.rows.keys()]).toEqual(['jti-3']);
  });

  it('does nothing at all when there is no valid refresh principal', async () => {
    const { service, prisma } = setup();
    await expect(service.revokeRefreshToken(null)).resolves.toBeUndefined();
    expect(prisma.revokedRefreshToken.upsert).not.toHaveBeenCalled();
    expect(prisma.revokedRefreshToken.deleteMany).not.toHaveBeenCalled();
  });
});
