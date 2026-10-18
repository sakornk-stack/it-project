import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConsentKind, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import {
  PRIVACY_POLICY_VERSION,
  STALE_PRIVACY_POLICY_MESSAGE,
} from '../../common/privacy/privacy-policy.constant';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { AuthService } from './auth.service';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { RegisterDto } from './dto/register.dto';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import { EmailSignupRequestService } from './email-signup-request.service';
import { PasswordResetService } from './password-reset.service';
import { PendingInvitationService } from './pending-invitation.service';
import { StudentInvitationService } from './student-invitation.service';
import { TwoFactorService } from './two-factor.service';

// two-factor.service imports otplib (ESM-only deps Jest can't parse); sign-up
// never touches 2FA.
jest.mock('./two-factor.service', () => ({ TwoFactorService: class {} }));

const user = { id: 'user-1', email: 'new@test.local' };
const PROGRAM_ID = 'a3f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';
const CURRICULUM_ID = 'b4f1c2e4-1234-4a5b-9c6d-7e8f9a0b1c2d';

const selfServiceBody = {
  email: 'new@test.local',
  password: 'P@ssw0rd123',
  fullName: 'New Student',
  studentCode: '6512345678',
  programId: PROGRAM_ID,
  curriculumId: CURRICULUM_ID,
  admissionYear: 2568,
  acceptPrivacyPolicy: true as const,
  privacyPolicyVersion: PRIVACY_POLICY_VERSION,
};

function setup() {
  const tx = {
    userConsent: { create: jest.fn().mockResolvedValue({}) },
    googlePendingRegistration: { delete: jest.fn().mockResolvedValue({}) },
  };
  const signupRequest = {
    id: 'req-1',
    tokenHash: 'hash',
    email: 'new@test.local',
    passwordHash: 'bcrypt',
    fullName: 'New Student',
    studentCode: '6512345678',
    programId: PROGRAM_ID,
    curriculumId: CURRICULUM_ID,
    admissionYear: 2568,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  };
  const emailSignupRequestService = {
    upsert: jest.fn().mockResolvedValue('raw-token'),
    findValidByToken: jest.fn().mockResolvedValue(signupRequest),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const emailService = { sendSignupVerificationEmail: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    revokedRefreshToken: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const userService = {
    create: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
    findByEmail: jest.fn().mockRejectedValue(new NotFoundException()),
    findAuthContext: jest.fn().mockResolvedValue({
      isActive: true,
      roles: [Role.STUDENT],
      mustChangePassword: false,
    }),
  };
  const userRoleService = {
    assignRole: jest.fn().mockResolvedValue(undefined),
    findRolesByUserId: jest.fn().mockResolvedValue([Role.STUDENT]),
  };
  const userAuthMethodService = { create: jest.fn().mockResolvedValue({}) };
  const studentProfileService = {
    create: jest.fn().mockResolvedValue({}),
    validateProgramAndCurriculum: jest.fn().mockResolvedValue({}),
  };
  const studentInvitationService = {
    findValidByToken: jest.fn().mockResolvedValue({
      id: 'inv-1',
      email: 'new@test.local',
      studentCode: '6512345678',
      programId: PROGRAM_ID,
      curriculumId: CURRICULUM_ID,
      admissionYear: 2568,
    }),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const googlePendingRegistrationService = {
    findValidByToken: jest.fn().mockResolvedValue({
      id: 'pending-1',
      email: 'g@test.local',
      googleId: 'google-sub',
      fullName: 'Google Student',
    }),
  };
  const config = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'test-access-secret',
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshSecret': 'test-refresh-secret',
        'jwt.refreshExpiresIn': '7d',
        'session.absoluteMaxHours': 8,
        'signup.allowedDomains': ['ku.th', 'test.local'],
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
    studentInvitationService as unknown as StudentInvitationService,
    unused as unknown as PasswordResetService,
    emailService as unknown as EmailService,
    unused as unknown as TwoFactorService,
    new JwtService({}),
    config as unknown as ConfigService,
  );
  return { service, prisma, tx, emailSignupRequestService };
}

const expectedConsent = {
  data: {
    userId: user.id,
    kind: ConsentKind.PRIVACY_POLICY,
    policyVersion: PRIVACY_POLICY_VERSION,
  },
};

describe('PRIVACY_POLICY_VERSION', () => {
  it('is pinned (bump together with apps/frontend/src/lib/privacy-policy.ts)', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('2026-10-18-draft.1');
  });
});

describe('sign-up DTOs require the privacy policy box', () => {
  const googleBody = {
    pendingToken: 'pending',
    studentCode: '6512345678',
    programId: PROGRAM_ID,
    curriculumId: CURRICULUM_ID,
    admissionYear: 2568,
    acceptPrivacyPolicy: true,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  };
  const invitedBody = {
    email: 'new@test.local',
    password: 'P@ssw0rd123',
    fullName: 'New Student',
    invitationToken: 'token',
    acceptPrivacyPolicy: true,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
  };
  const cases: [string, new () => object, Record<string, unknown>][] = [
    ['RegisterDto (self-service)', RegisterDto, selfServiceBody],
    ['RegisterDto (invitation)', RegisterDto, invitedBody],
    ['CompleteGoogleRegistrationDto', CompleteGoogleRegistrationDto, googleBody],
  ];

  async function errorProps(cls: new () => object, body: Record<string, unknown>) {
    const errors = await validate(plainToInstance(cls, body));
    return errors.map((e) => e.property);
  }

  it.each(cases)('%s passes when ticked with a version', async (_name, cls, body) => {
    expect(await errorProps(cls, body)).toEqual([]);
  });

  it.each(cases)('%s rejects a missing or false acceptPrivacyPolicy', async (_name, cls, body) => {
    const missing = { ...body };
    delete missing.acceptPrivacyPolicy;
    expect(await errorProps(cls, missing)).toContain('acceptPrivacyPolicy');
    expect(await errorProps(cls, { ...body, acceptPrivacyPolicy: false })).toContain(
      'acceptPrivacyPolicy',
    );
    expect(await errorProps(cls, { ...body, acceptPrivacyPolicy: 'true' })).toContain(
      'acceptPrivacyPolicy',
    );
  });

  it.each(cases)('%s rejects a missing privacyPolicyVersion', async (_name, cls, body) => {
    const missing = { ...body };
    delete missing.privacyPolicyVersion;
    expect(await errorProps(cls, missing)).toContain('privacyPolicyVersion');
  });
});

describe('AuthService records consent with the account', () => {
  it('self-service register keeps the accepted version on the pending request, creating nothing yet', async () => {
    const { service, prisma, tx, emailSignupRequestService } = setup();
    await service.register(selfServiceBody as RegisterDto);
    expect(emailSignupRequestService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ privacyPolicyVersion: PRIVACY_POLICY_VERSION }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.userConsent.create).not.toHaveBeenCalled();
  });

  it('email verification writes the consent row inside the account transaction', async () => {
    const { service, prisma, tx } = setup();
    const result = await service.verifyEmailSignup('raw-token');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userConsent.create).toHaveBeenCalledWith(expectedConsent);
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it('invited register writes the consent row too', async () => {
    const { service, tx } = setup();
    await service.register({
      email: 'new@test.local',
      password: 'P@ssw0rd123',
      fullName: 'New Student',
      invitationToken: 'token',
      acceptPrivacyPolicy: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    } as RegisterDto);
    expect(tx.userConsent.create).toHaveBeenCalledWith(expectedConsent);
  });

  it('Google registration completion writes the consent row too', async () => {
    const { service, tx } = setup();
    await service.completeGoogleRegistration({
      pendingToken: 'pending',
      studentCode: '6512345678',
      programId: PROGRAM_ID,
      curriculumId: CURRICULUM_ID,
      admissionYear: 2568,
      acceptPrivacyPolicy: true,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    } as CompleteGoogleRegistrationDto);
    expect(tx.userConsent.create).toHaveBeenCalledWith(expectedConsent);
  });

  it('refuses a stale policy version before opening any transaction', async () => {
    const { service, prisma } = setup();
    const stale = { ...selfServiceBody, privacyPolicyVersion: '2000-01-01-draft.0' };
    await expect(service.register(stale as RegisterDto)).rejects.toThrow(
      new BadRequestException(STALE_PRIVACY_POLICY_MESSAGE),
    );
    await expect(
      service.completeGoogleRegistration({
        pendingToken: 'pending',
        studentCode: '6512345678',
        programId: PROGRAM_ID,
        curriculumId: CURRICULUM_ID,
        admissionYear: 2568,
        acceptPrivacyPolicy: true,
        privacyPolicyVersion: '2000-01-01-draft.0',
      } as CompleteGoogleRegistrationDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('issues no tokens when the consent row cannot be written', async () => {
    const { service, tx } = setup();
    tx.userConsent.create.mockRejectedValueOnce(new Error('db down'));
    await expect(service.verifyEmailSignup('raw-token')).rejects.toThrow('db down');
  });
});
