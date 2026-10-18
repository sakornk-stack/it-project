import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
// otplib (pulled in by the real services) ships ESM that Jest can't parse;
// the controller only needs these as injectable types here.
jest.mock('./auth.service', () => ({ AuthService: class {} }));
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { GoogleSignupRefusedException } from './google-signup-refused.exception';

function setup(handleGoogleCallback: jest.Mock) {
  const authService = { handleGoogleCallback } as unknown as AuthService;
  const config = {
    get: (key: string) => (key === 'frontendUrl' ? 'http://fe.test' : undefined),
  } as unknown as ConfigService;
  const controller = new AuthController(
    authService,
    {} as TwoFactorService,
    config,
  );
  const response = { redirect: jest.fn(), cookie: jest.fn() };
  const profile = { email: 'a@b.c', googleId: 'g1', fullName: 'A B', emailVerified: true };
  return { controller, response, profile };
}

describe('AuthController.googleAuthCallback', () => {
  it.each(['email_unverified', 'domain_not_allowed'] as const)(
    'redirects to /login?googleError=%s when Google claims rule the sign-up out',
    async (reason) => {
      const { controller, response, profile } = setup(
        jest.fn().mockRejectedValue(new GoogleSignupRefusedException(reason)),
      );
      await controller.googleAuthCallback(profile, response as unknown as Response);
      expect(response.redirect).toHaveBeenCalledWith(`http://fe.test/login?googleError=${reason}`);
      expect(response.cookie).not.toHaveBeenCalled();
    },
  );

  it('redirects to /login with a code (not raw JSON) when the email already has an account', async () => {
    const { controller, response, profile } = setup(
      jest.fn().mockRejectedValue(new ConflictException('exists')),
    );
    await controller.googleAuthCallback(profile, response as unknown as Response);
    expect(response.redirect).toHaveBeenCalledWith(
      'http://fe.test/login?googleError=email_exists',
    );
  });

  it('still rethrows unexpected errors', async () => {
    const { controller, response, profile } = setup(
      jest.fn().mockRejectedValue(new InternalServerErrorException()),
    );
    await expect(
      controller.googleAuthCallback(profile, response as unknown as Response),
    ).rejects.toThrow(InternalServerErrorException);
    expect(response.redirect).not.toHaveBeenCalled();
  });

  it('new identity still goes to the student-info form', async () => {
    const { controller, response, profile } = setup(
      jest.fn().mockResolvedValue({ pendingToken: 'tok+/', isNewUser: true }),
    );
    await controller.googleAuthCallback(profile, response as unknown as Response);
    expect(response.redirect).toHaveBeenCalledWith(
      'http://fe.test/register/google?pendingToken=tok%2B%2F',
    );
  });
});
