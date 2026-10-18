import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { AuthService } from './auth.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import { EmailSignupRequestService } from './email-signup-request.service';
import { PasswordResetService } from './password-reset.service';
import { PendingInvitationService } from './pending-invitation.service';
import { StudentInvitationService } from './student-invitation.service';
import { TwoFactorService } from './two-factor.service';

// two-factor.service imports otplib, which ships ESM-only dependencies
// this repo's Jest (CommonJS) setup can't parse. forgotPassword never
// touches 2FA, so a stub class is enough for the constructor.
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const GENERIC_MESSAGE = { message: 'If an account exists, a reset link has been sent' };

function setup({
  user,
  send,
}: {
  user: { id: string; email: string; passwordHash: string | null } | null;
  send?: () => Promise<void>;
}) {
  const userService = {
    findByEmail: jest.fn(() =>
      user ? Promise.resolve(user) : Promise.reject(new NotFoundException()),
    ),
  };
  const passwordResetService = { create: jest.fn().mockResolvedValue('reset-token') };
  const emailService = {
    sendPasswordSetupEmail: jest.fn(send ?? (() => Promise.resolve())),
  };
  const unused = {};
  const service = new AuthService(
    unused as unknown as PrismaService,
    userService as unknown as UserService,
    unused as unknown as UserRoleService,
    unused as unknown as UserAuthMethodService,
    unused as unknown as StudentProfileService,
    unused as unknown as GooglePendingRegistrationService,
    unused as unknown as EmailSignupRequestService,
    unused as unknown as PendingInvitationService,
    unused as unknown as StudentInvitationService,
    passwordResetService as unknown as PasswordResetService,
    emailService as unknown as EmailService,
    unused as unknown as TwoFactorService,
    unused as unknown as JwtService,
    unused as unknown as ConfigService,
  );
  return { service, passwordResetService, emailService };
}

const existingUser = { id: 'user-1', email: 'someone@example.com', passwordHash: 'hash' };

describe('AuthService.forgotPassword', () => {
  it('returns the generic message without a token or email when the account does not exist', async () => {
    const { service, passwordResetService, emailService } = setup({ user: null });

    await expect(service.forgotPassword({ email: 'nobody@example.com' })).resolves.toEqual(
      GENERIC_MESSAGE,
    );
    expect(passwordResetService.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });

  it('responds without waiting for the email send to finish', async () => {
    const { service, emailService } = setup({
      user: existingUser,
      send: () => new Promise<void>(() => {}),
    });

    await expect(service.forgotPassword({ email: existingUser.email })).resolves.toEqual(
      GENERIC_MESSAGE,
    );
    expect(emailService.sendPasswordSetupEmail).toHaveBeenCalledWith(
      existingUser.email,
      'reset-token',
      'reset',
    );
  });

  it('swallows a failed send without an unhandled rejection', async () => {
    const onUnhandled = jest.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const { service } = setup({
        user: existingUser,
        send: () => Promise.reject(new Error('SMTP down')),
      });

      await expect(service.forgotPassword({ email: existingUser.email })).resolves.toEqual(
        GENERIC_MESSAGE,
      );
      await new Promise((resolve) => setImmediate(resolve));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  // The first SUPER_ADMIN (src/cli/create-first-admin.ts) sets its password
  // through this flow, so the role must never change the outcome or reply.
  it('treats a SUPER_ADMIN account like any other and never consults the role', async () => {
    const { service, passwordResetService, emailService } = setup({
      user: { id: 'admin-1', email: 'admin@example.com', passwordHash: 'unusable-hash' },
    });
    const missing = setup({ user: null });

    const forAdmin = await service.forgotPassword({ email: 'admin@example.com' });
    const forNobody = await missing.service.forgotPassword({ email: 'nobody@example.com' });

    expect(forAdmin).toEqual(GENERIC_MESSAGE);
    expect(forAdmin).toEqual(forNobody);
    expect(passwordResetService.create).toHaveBeenCalledWith('admin-1');
    expect(emailService.sendPasswordSetupEmail).toHaveBeenCalledWith(
      'admin@example.com',
      'reset-token',
      'reset',
    );
  });

  it('sends nothing for a Google-only account with no password', async () => {
    const { service, passwordResetService, emailService } = setup({
      user: { ...existingUser, passwordHash: null },
    });

    await expect(service.forgotPassword({ email: existingUser.email })).resolves.toEqual(
      GENERIC_MESSAGE,
    );
    expect(passwordResetService.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordSetupEmail).not.toHaveBeenCalled();
  });
});
