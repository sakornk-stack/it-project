import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Response } from 'express';
// otplib (pulled in by the real services) ships ESM that Jest can't parse;
// the controller only needs these as injectable types here.
jest.mock('./auth.service', () => ({ AuthService: class {} }));
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtRefreshGuard } from '../../common/guards/jwt-refresh-optional.guard';

function setup() {
  const authService = {
    revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: () => 'development' } as unknown as ConfigService;
  const controller = new AuthController(
    authService as unknown as AuthService,
    {} as TwoFactorService,
    config,
  );
  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
  return {
    controller,
    authService,
    response: response as unknown as Response,
    raw: response,
  };
}

describe('POST /auth/logout', () => {
  it('authenticates with the refresh cookie, not the (15m) access token', () => {
    const guards: unknown[] = Reflect.getMetadata('__guards__', AuthController.prototype.logout);
    expect(guards).toContain(OptionalJwtRefreshGuard);
    expect(guards).not.toContain(JwtAuthGuard);
  });

  it('revokes the refresh token and clears the cookie — works with no access token at all', async () => {
    const { controller, authService, response, raw } = setup();
    const principal = {
      userId: 'u1',
      email: 'u@test.local',
      roles: [Role.STUDENT],
      mustChangePassword: false,
      refreshJti: 'jti-1',
      refreshExp: 123,
    };

    await expect(controller.logout(principal, response)).resolves.toEqual({
      message: 'Logged out',
    });
    expect(authService.revokeRefreshToken).toHaveBeenCalledWith(principal);
    expect(raw.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ path: '/api/auth' }),
    );
  });

  it('with no/invalid cookie (null principal) only clears the cookie and still succeeds', async () => {
    const { controller, authService, response, raw } = setup();

    await expect(controller.logout(null, response)).resolves.toEqual({
      message: 'Logged out',
    });
    expect(authService.revokeRefreshToken).toHaveBeenCalledWith(null);
    expect(raw.clearCookie).toHaveBeenCalledTimes(1);
    expect(raw.cookie).not.toHaveBeenCalled();
  });
});

describe('OptionalJwtRefreshGuard.handleRequest', () => {
  const guard = new OptionalJwtRefreshGuard();

  it('passes a valid principal through', () => {
    const principal = { userId: 'u1' };
    expect(guard.handleRequest(null, principal)).toBe(principal);
  });

  it.each([false, undefined, null])('resolves to null instead of throwing for %p', (user) => {
    expect(guard.handleRequest(new Error('jwt expired'), user as never)).toBeNull();
  });
});
