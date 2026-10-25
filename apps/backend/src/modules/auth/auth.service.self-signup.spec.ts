import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthProvider, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { PRIVACY_POLICY_VERSION } from '../../common/privacy/privacy-policy.constant';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import {
  AuthService,
  SIGNUP_CHECK_EMAIL_MESSAGE,
  SIGNUP_EMAIL_TAKEN_MESSAGE,
  SIGNUP_STUDENT_CODE_TAKEN_MESSAGE,
} from './auth.service';
import { RegisterDto } from './dto/register.dto';
import {
  EmailSignupRequestService,
  INVALID_SIGNUP_LINK_MESSAGE,
} from './email-signup-request.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import { GoogleProfile } from './google-profile.interface';
import { GoogleSignupRefusedException } from './google-signup-refused.exception';
import { PasswordResetService } from './password-reset.service';
import { PendingInvitationService } from './pending-invitation.service';
import { StudentInvitationService } from './student-invitation.service';
import { TwoFactorService } from './two-factor.service';

// two-factor.service imports otplib (ESM-only deps Jest can't parse).
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const PROGRAM_ID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const CURRICULUM_ID = 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const newUser = { id: 'user-new', email: 'somchai.j@ku.th' };

const body = (email: string) =>
  ({
    email,
    password: 'P@ssw0rd123',
    fullName: 'Somchai J',
    studentCode: '6512345678',
    programId: PROGRAM_ID,
    curriculumId: CURRICULUM_ID,
    admissionYear: 2568,
    acceptPrivacyPolicy: true,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  }) as RegisterDto;

const storedRequest = {
  id: 'req-1',
  tokenHash: 'hash-of-token',
  email: 'somchai.j@ku.th',
  passwordHash: 'bcrypt-hash',
  fullName: 'Somchai J',
  studentCode: '6512345678',
  programId: PROGRAM_ID,
  curriculumId: CURRICULUM_ID,
  admissionYear: 2568,
  privacyPolicyVersion: PRIVACY_POLICY_VERSION,
};

function setup(opts: { existingEmails?: string[]; requireHostedDomain?: boolean } = {}) {
  const existing = new Set((opts.existingEmails ?? []).map((e) => e.toLowerCase()));
  const tx = {
    userConsent: { create: jest.fn().mockResolvedValue({}) },
    googlePendingRegistration: { delete: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    revokedRefreshToken: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const userService = {
    // Mirrors UserService.findByEmail: case-insensitive.
    findByEmail: jest.fn(async (email: string) => {
      if (existing.has(email.trim().toLowerCase())) return { id: 'old', email, passwordHash: 'h' };
      throw new NotFoundException();
    }),
    create: jest.fn().mockResolvedValue(newUser),
    findById: jest.fn().mockResolvedValue(newUser),
    findAuthContext: jest
      .fn()
      .mockResolvedValue({ isActive: true, roles: [Role.STUDENT], mustChangePassword: false }),
  };
  const userRoleService = {
    assignRole: jest.fn().mockResolvedValue(undefined),
    findRolesByUserId: jest.fn().mockResolvedValue([Role.STUDENT]),
  };
  const userAuthMethodService = {
    create: jest.fn().mockResolvedValue({}),
    findByProviderAndProviderUserId: jest.fn().mockResolvedValue(null),
    findByUserIdAndProvider: jest.fn().mockResolvedValue(null),
  };
  const studentProfileService = {
    create: jest.fn().mockResolvedValue({}),
    validateProgramAndCurriculum: jest.fn().mockResolvedValue({}),
  };
  const emailSignupRequestService = {
    upsert: jest.fn().mockResolvedValue('raw-token'),
    resend: jest.fn().mockResolvedValue('raw-token-2'),
    findValidByToken: jest.fn().mockResolvedValue(storedRequest),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const googlePendingRegistrationService = {
    create: jest.fn().mockResolvedValue('pending-token'),
    findValidByToken: jest.fn(),
  };
  const emailService = { sendSignupVerificationEmail: jest.fn().mockResolvedValue(undefined) };
  const twoFactorService = { isEnabled: jest.fn().mockResolvedValue(false) };
  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'test-access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '7d',
        'jwt.twoFactorPendingSecret': 'test-2fa-pending-secret',
        'jwt.twoFactorPendingExpiresIn': '5m',
        'session.absoluteMaxHours': 8,
        'signup.allowedDomains': ['ku.th'],
        'google.requireHostedDomain': opts.requireHostedDomain ?? false,
      })[key],
  };
  const unused = {};
  const service = new AuthService(
    prisma as unknown as PrismaService,
    userService as unknown as UserService,
    userRoleService as unknown as UserRoleService,
    userAuthMethodService as unknown as UserAuthMethodService,
    studentProfileService as unknown as StudentProfileService,
    googlePendingRegistrationService as unknown as GooglePendingRegistrationService,
    emailSignupRequestService as unknown as EmailSignupRequestService,
    unused as unknown as PendingInvitationService,
    unused as unknown as StudentInvitationService,
    unused as unknown as PasswordResetService,
    emailService as unknown as EmailService,
    twoFactorService as unknown as TwoFactorService,
    new JwtService({}),
    config as unknown as ConfigService,
  );
  return {
    service,
    prisma,
    tx,
    userService,
    userRoleService,
    userAuthMethodService,
    studentProfileService,
    emailSignupRequestService,
    googlePendingRegistrationService,
    emailService,
    twoFactorService,
  };
}

describe('email sign-up step 1 (POST /auth/register without invitation)', () => {
  it.each(['x@evil.com', 'x@evilku.th', 'x@sub.ku.th', 'x@ku.th.evil.com', 'x@ku.ac.th'])(
    'refuses %s with a Thai 400 and writes nothing',
    async (email) => {
      const { service, emailSignupRequestService, emailService } = setup();
      const call = service.register(body(email));
      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('@ku.th');
      expect(emailSignupRequestService.upsert).not.toHaveBeenCalled();
      expect(emailService.sendSignupVerificationEmail).not.toHaveBeenCalled();
    },
  );

  it('stores a request (normalised email) and mails the link; no account and no tokens', async () => {
    const { service, prisma, emailSignupRequestService, emailService } = setup();
    const result = await service.register(body('  Somchai.J@KU.TH '));
    expect(result).toEqual({ message: SIGNUP_CHECK_EMAIL_MESSAGE });
    expect(result).not.toHaveProperty('accessToken');
    expect(emailSignupRequestService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'somchai.j@ku.th', studentCode: '6512345678' }),
    );
    const stored = emailSignupRequestService.upsert.mock.calls[0][0];
    expect(stored.passwordHash).not.toBe('P@ssw0rd123');
    expect(emailService.sendSignupVerificationEmail).toHaveBeenCalledWith(
      'somchai.j@ku.th',
      'raw-token',
      30,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['somchai.j@ku.th', 'SOMCHAI.J@KU.TH'])(
    'answers an address that already has an account (%s) exactly like a new one, sending nothing',
    async (email) => {
      const { service, emailSignupRequestService, emailService } = setup({
        existingEmails: ['somchai.j@ku.th'],
      });
      const result = await service.register(body(email));
      expect(result).toEqual({ message: SIGNUP_CHECK_EMAIL_MESSAGE });
      expect(emailSignupRequestService.upsert).not.toHaveBeenCalled();
      expect(emailService.sendSignupVerificationEmail).not.toHaveBeenCalled();
    },
  );

  it('sends nothing (same answer) when the address is in its cooldown or out of sends', async () => {
    const { service, emailSignupRequestService, emailService } = setup();
    emailSignupRequestService.upsert.mockResolvedValueOnce(null);
    await expect(service.register(body('somchai.j@ku.th'))).resolves.toEqual({
      message: SIGNUP_CHECK_EMAIL_MESSAGE,
    });
    expect(emailService.sendSignupVerificationEmail).not.toHaveBeenCalled();
  });

  it('checks the program/curriculum pair before storing anything', async () => {
    const { service, studentProfileService, emailSignupRequestService } = setup();
    studentProfileService.validateProgramAndCurriculum.mockRejectedValueOnce(
      new BadRequestException('mismatch'),
    );
    await expect(service.register(body('somchai.j@ku.th'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(emailSignupRequestService.upsert).not.toHaveBeenCalled();
  });

  it('an unverified sign-up cannot log in (there is no account yet)', async () => {
    const { service } = setup();
    await service.register(body('somchai.j@ku.th'));
    await expect(
      service.login({ email: 'somchai.j@ku.th', password: 'P@ssw0rd123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('email sign-up step 2 (POST /auth/register/verify)', () => {
  it('creates a STUDENT account from the stored request, consuming it in the same transaction', async () => {
    const {
      service,
      prisma,
      userService,
      userRoleService,
      userAuthMethodService,
      emailSignupRequestService,
    } = setup();
    const result = await service.verifyEmailSignup('raw-token');
    expect(result.accessToken).toEqual(expect.any(String));
    expect(userService.create).toHaveBeenCalledWith(
      'somchai.j@ku.th',
      'bcrypt-hash',
      'Somchai J',
      expect.anything(),
    );
    expect(userRoleService.assignRole).toHaveBeenCalledWith(
      newUser.id,
      Role.STUDENT,
      expect.anything(),
    );
    expect(userRoleService.assignRole).toHaveBeenCalledTimes(1);
    expect(userAuthMethodService.create).toHaveBeenCalledWith(
      newUser.id,
      AuthProvider.PASSWORD,
      null,
      expect.anything(),
    );
    expect(emailSignupRequestService.consume).toHaveBeenCalledWith(
      storedRequest,
      expect.anything(),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses an expired, unknown or already used link with 401 and creates nothing', async () => {
    const { service, emailSignupRequestService, userService } = setup();
    emailSignupRequestService.findValidByToken.mockRejectedValueOnce(
      new UnauthorizedException(INVALID_SIGNUP_LINK_MESSAGE),
    );
    await expect(service.verifyEmailSignup('used')).rejects.toThrow(INVALID_SIGNUP_LINK_MESSAGE);
    expect(userService.create).not.toHaveBeenCalled();
  });

  it('issues no tokens when a concurrent click already consumed the link', async () => {
    const { service, emailSignupRequestService } = setup();
    emailSignupRequestService.consume.mockRejectedValueOnce(
      new UnauthorizedException(INVALID_SIGNUP_LINK_MESSAGE),
    );
    await expect(service.verifyEmailSignup('raw-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('409s in Thai when the address got an account in the meantime', async () => {
    const { service, userService } = setup({ existingEmails: ['somchai.j@ku.th'] });
    await expect(service.verifyEmailSignup('raw-token')).rejects.toThrow(
      SIGNUP_EMAIL_TAKEN_MESSAGE,
    );
    expect(userService.create).not.toHaveBeenCalled();
  });

  it('409s in Thai when the student code is already taken', async () => {
    const { service, studentProfileService } = setup();
    studentProfileService.create.mockRejectedValueOnce(
      new ConflictException(
        'User x already has a student profile, or student code "1" is already in use',
      ),
    );
    const call = service.verifyEmailSignup('raw-token');
    await expect(call).rejects.toBeInstanceOf(ConflictException);
    await expect(call).rejects.toThrow(SIGNUP_STUDENT_CODE_TAKEN_MESSAGE);
  });
});

describe('email sign-up resend (POST /auth/register/resend)', () => {
  it('mails a new link for a live request on an allowed domain', async () => {
    const { service, emailSignupRequestService, emailService } = setup();
    await expect(service.resendEmailSignup('Somchai.J@ku.th')).resolves.toEqual({
      message: SIGNUP_CHECK_EMAIL_MESSAGE,
    });
    expect(emailSignupRequestService.resend).toHaveBeenCalledWith('somchai.j@ku.th');
    expect(emailService.sendSignupVerificationEmail).toHaveBeenCalledWith(
      'somchai.j@ku.th',
      'raw-token-2',
      30,
    );
  });

  it('gives the same answer and sends nothing with no live request or when capped', async () => {
    const { service, emailSignupRequestService, emailService } = setup();
    emailSignupRequestService.resend.mockResolvedValueOnce(null);
    await expect(service.resendEmailSignup('nobody@ku.th')).resolves.toEqual({
      message: SIGNUP_CHECK_EMAIL_MESSAGE,
    });
    expect(emailService.sendSignupVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not even look up other domains, and still answers the same', async () => {
    const { service, emailSignupRequestService } = setup();
    await expect(service.resendEmailSignup('x@evilku.th')).resolves.toEqual({
      message: SIGNUP_CHECK_EMAIL_MESSAGE,
    });
    expect(emailSignupRequestService.resend).not.toHaveBeenCalled();
  });
});

describe('self-service sign-up never takes a role from the client', () => {
  it('RegisterDto rejects a role field under the app ValidationPipe options', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, { ...body('somchai.j@ku.th'), role: 'ADMIN' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toContain('role');
  });
});

describe('Google sign-in claims (handleGoogleCallback)', () => {
  const google = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
    email: 'Somchai.J@ku.th',
    googleId: 'g-sub',
    fullName: 'Somchai J',
    emailVerified: true,
    hostedDomain: 'ku.th',
    ...over,
  });

  it('refuses an unverified address, even for a returning linked user', async () => {
    const { service, userAuthMethodService, googlePendingRegistrationService } = setup();
    userAuthMethodService.findByProviderAndProviderUserId.mockResolvedValueOnce({ userId: 'old' });
    const call = service.handleGoogleCallback(google({ emailVerified: false }));
    await expect(call).rejects.toBeInstanceOf(GoogleSignupRefusedException);
    await expect(call).rejects.toMatchObject({ reason: 'email_unverified' });
    expect(googlePendingRegistrationService.create).not.toHaveBeenCalled();
  });

  it.each(['x@gmail.com', 'x@evilku.th', 'x@sub.ku.th'])(
    'refuses a new sign-up from %s and parks nothing',
    async (email) => {
      const { service, googlePendingRegistrationService } = setup();
      const call = service.handleGoogleCallback(google({ email }));
      await expect(call).rejects.toMatchObject({ reason: 'domain_not_allowed' });
      expect(googlePendingRegistrationService.create).not.toHaveBeenCalled();
    },
  );

  it('parks a verified, allowed-domain new identity with the normalised email', async () => {
    const { service, googlePendingRegistrationService } = setup();
    await expect(service.handleGoogleCallback(google())).resolves.toEqual({
      pendingToken: 'pending-token',
      isNewUser: true,
    });
    expect(googlePendingRegistrationService.create).toHaveBeenCalledWith(
      'somchai.j@ku.th',
      'g-sub',
      'Somchai J',
    );
  });

  it('links Google to an existing account with the same address (any case) and signs in', async () => {
    const { service, userAuthMethodService, googlePendingRegistrationService } = setup({
      existingEmails: ['somchai.j@ku.th'],
    });
    const result = await service.handleGoogleCallback(google());
    expect(userAuthMethodService.create).toHaveBeenCalledWith('old', AuthProvider.GOOGLE, 'g-sub');
    expect(result).toHaveProperty('accessToken');
    expect(googlePendingRegistrationService.create).not.toHaveBeenCalled();
  });

  it('still asks for the 2FA code after linking when the account has 2FA on', async () => {
    const { service, twoFactorService } = setup({ existingEmails: ['somchai.j@ku.th'] });
    twoFactorService.isEnabled.mockResolvedValueOnce(true);
    const result = await service.handleGoogleCallback(google());
    expect(result).toMatchObject({ requiresTwoFactor: true });
    expect(result).not.toHaveProperty('accessToken');
  });

  it('refuses when the account is already linked to a different Google account', async () => {
    const { service, userAuthMethodService } = setup({ existingEmails: ['somchai.j@ku.th'] });
    userAuthMethodService.findByUserIdAndProvider.mockResolvedValueOnce({ providerUserId: 'other' });
    await expect(service.handleGoogleCallback(google())).rejects.toBeInstanceOf(ConflictException);
    expect(userAuthMethodService.create).not.toHaveBeenCalled();
  });

  it('does not link when the Workspace hd check is on and fails', async () => {
    const { service, userAuthMethodService } = setup({
      existingEmails: ['somchai.j@ku.th'],
      requireHostedDomain: true,
    });
    const call = service.handleGoogleCallback(google({ hostedDomain: undefined }));
    await expect(call).rejects.toMatchObject({ reason: 'domain_not_allowed' });
    expect(userAuthMethodService.create).not.toHaveBeenCalled();
  });

  it('lets a returning linked user in without re-checking the domain', async () => {
    const { service, userAuthMethodService } = setup();
    userAuthMethodService.findByProviderAndProviderUserId.mockResolvedValueOnce({ userId: 'old' });
    const result = await service.handleGoogleCallback(
      google({ email: 'old@gmail.com', hostedDomain: undefined }),
    );
    expect(result).toHaveProperty('accessToken');
  });

  describe('with GOOGLE_REQUIRE_HOSTED_DOMAIN=true', () => {
    it('refuses a consumer account without the Workspace hd claim', async () => {
      const { service } = setup({ requireHostedDomain: true });
      await expect(
        service.handleGoogleCallback(google({ hostedDomain: undefined })),
      ).rejects.toMatchObject({ reason: 'domain_not_allowed' });
    });

    it('refuses an hd that does not match the email domain', async () => {
      const { service } = setup({ requireHostedDomain: true });
      await expect(
        service.handleGoogleCallback(google({ hostedDomain: 'evilku.th' })),
      ).rejects.toMatchObject({ reason: 'domain_not_allowed' });
    });

    it('accepts a matching Workspace account', async () => {
      const { service } = setup({ requireHostedDomain: true });
      await expect(service.handleGoogleCallback(google())).resolves.toHaveProperty(
        'isNewUser',
        true,
      );
    });
  });

  it('completeGoogleRegistration re-checks the domain of the server-side pending row', async () => {
    const { service, googlePendingRegistrationService, userService } = setup();
    googlePendingRegistrationService.findValidByToken.mockResolvedValueOnce({
      id: 'p1',
      email: 'x@evilku.th',
      googleId: 'g',
      fullName: 'X',
    });
    await expect(
      service.completeGoogleRegistration({
        pendingToken: 'pending',
        studentCode: '6512345678',
        programId: PROGRAM_ID,
        curriculumId: CURRICULUM_ID,
        admissionYear: 2568,
        acceptPrivacyPolicy: true,
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userService.create).not.toHaveBeenCalled();
  });
});
