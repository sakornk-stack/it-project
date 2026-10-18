import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthProvider, ConsentKind, Prisma, Role, User } from '@prisma/client';
import { hashPassword } from '../../common/util/password.util';
import { isAllowedSignupEmail, normalizeEmail } from '../../common/auth/signup-domain';
import { assertCurrentPrivacyPolicyVersion } from '../../common/privacy/privacy-policy.constant';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import {
  EmailSignupRequestService,
  SIGNUP_LINK_TTL_MINUTES,
} from './email-signup-request.service';
import { PendingInvitationService } from './pending-invitation.service';
import { StudentInvitationService } from './student-invitation.service';
import { PasswordResetService } from './password-reset.service';
import { EmailService } from '../../common/email/email.service';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { JwtPayload } from './jwt-payload.interface';
import { RequestUser } from './request-user.interface';
import { GoogleProfile } from './google-profile.interface';
import { GoogleSignupRefusedException } from './google-signup-refused.exception';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_TWO_FACTOR_CODE_MESSAGE = 'Invalid verification code';
// One answer for every self-service sign-up or resend that passes validation,
// whether or not the address already has an account — no account enumeration.
export const SIGNUP_CHECK_EMAIL_MESSAGE = `หากอีเมลนี้สมัครได้ เราได้ส่งลิงก์ยืนยันไปที่อีเมลแล้ว ลิงก์มีอายุ ${SIGNUP_LINK_TTL_MINUTES} นาที`;
export const SIGNUP_EMAIL_TAKEN_MESSAGE = 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ';
export const SIGNUP_STUDENT_CODE_TAKEN_MESSAGE =
  'รหัสนิสิตนี้ถูกใช้แล้ว หากเป็นรหัสของคุณ กรุณาติดต่อเจ้าหน้าที่';


const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MAX_MINUTES = 15;

interface CreateStudentAccountParams {
  email: string;
  passwordHash: string | null;
  fullName: string;
  provider: AuthProvider;
  providerUserId: string | null;
  studentCode: string;
  programId: string;
  curriculumId: string;
  admissionYear: number;
  // Version the person accepted; recorded as a UserConsent in the same
  // transaction as the account.
  privacyPolicyVersion: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly userRoleService: UserRoleService,
    private readonly userAuthMethodService: UserAuthMethodService,
    private readonly studentProfileService: StudentProfileService,
    private readonly googlePendingRegistrationService: GooglePendingRegistrationService,
    private readonly emailSignupRequestService: EmailSignupRequestService,
    private readonly pendingInvitationService: PendingInvitationService,
    private readonly studentInvitationService: StudentInvitationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Invitation: creates the account and logs in (the emailed invitation link
  // already proved the mailbox). Without one: only starts an email sign-up
  // (requestEmailSignup) — no account, no tokens, until the link is used.
  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string } | { message: string }> {
    assertCurrentPrivacyPolicyVersion(dto.privacyPolicyVersion);
    if (!dto.invitationToken) return this.requestEmailSignup(dto);
    const passwordHash = await hashPassword(dto.password);

    // Invited path: academic fields always come from the StudentInvitation
    // row, never from dto — a tampered client body can't smuggle a
    // different program/curriculum/studentCode through a valid token.
    // Only email is cross-checked (a token can't be replayed against a
    // different address) and only fullName is allowed to differ (the
    // student may correct a typo staff made).
    const invitation = await this.studentInvitationService.findValidByToken(
      dto.invitationToken,
    );
    if (normalizeEmail(invitation.email) !== normalizeEmail(dto.email)) {
      throw new BadRequestException(
        'Email must match the one this invitation was sent to',
      );
    }

    const user = await this.createStudentAccount(
      {
        email: normalizeEmail(invitation.email),
        passwordHash,
        fullName: dto.fullName,
        provider: AuthProvider.PASSWORD,
        providerUserId: null,
        studentCode: invitation.studentCode,
        programId: invitation.programId,
        curriculumId: invitation.curriculumId,
        admissionYear: invitation.admissionYear,
        privacyPolicyVersion: dto.privacyPolicyVersion,
      },
      (tx) => this.studentInvitationService.consume(invitation.id, tx),
    );
    return this.issueTokenPair(user);
  }

  // Self-service email+password sign-up, step 1. Allowed domains only. Every
  // request that passes validation gets the same answer, and the only work
  // that differs (the mail) is not awaited, so neither the body nor the
  // response time tells whether the address already has an account.
  private async requestEmailSignup(dto: RegisterDto): Promise<{ message: string }> {
    // class-validator only marks these @IsOptional at the DTO level (the
    // requirement depends on invitationToken's presence), so it's enforced here.
    if (
      !dto.studentCode ||
      !dto.programId ||
      !dto.curriculumId ||
      dto.admissionYear === undefined
    ) {
      throw new BadRequestException(
        'studentCode, programId, curriculumId, and admissionYear are required without an invitationToken',
      );
    }
    const email = normalizeEmail(dto.email);
    this.assertSignupDomain(email);
    // Says nothing about accounts, so it can fail loudly here instead of
    // after the person has clicked the link.
    await this.studentProfileService.validateProgramAndCurriculum(dto.programId, dto.curriculumId);
    // Hashed before the existence check so both branches cost the same.
    const passwordHash = await hashPassword(dto.password);

    if (!(await this.emailHasAccount(email))) {
      const token = await this.emailSignupRequestService.upsert({
        email,
        passwordHash,
        fullName: dto.fullName,
        studentCode: dto.studentCode,
        programId: dto.programId,
        curriculumId: dto.curriculumId,
        admissionYear: dto.admissionYear,
        privacyPolicyVersion: dto.privacyPolicyVersion,
      });
      if (token) this.mailSignupLink(email, token);
    }
    return { message: SIGNUP_CHECK_EMAIL_MESSAGE };
  }

  // Step 2: the link from the mail. Creates the STUDENT account (with the
  // consent recorded at step 1) and logs in. The request row is consumed in
  // the same transaction, so a link works once even if clicked twice at once.
  async verifyEmailSignup(token: string) {
    const request = await this.emailSignupRequestService.findValidByToken(token);
    // Only the mailbox owner gets this far, so naming the cause is not an
    // enumeration leak.
    if (await this.emailHasAccount(request.email)) {
      throw new ConflictException(SIGNUP_EMAIL_TAKEN_MESSAGE);
    }
    let user: User;
    try {
      user = await this.createStudentAccount(
        {
          email: request.email,
          passwordHash: request.passwordHash,
          fullName: request.fullName,
          provider: AuthProvider.PASSWORD,
          providerUserId: null,
          studentCode: request.studentCode,
          programId: request.programId,
          curriculumId: request.curriculumId,
          admissionYear: request.admissionYear,
          privacyPolicyVersion: request.privacyPolicyVersion,
        },
        (tx) => this.emailSignupRequestService.consume(request, tx),
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        // UserService (email raced in) or StudentProfileService (code taken).
        const emailClash = String(error.message).startsWith('Email');
        throw new ConflictException(
          emailClash ? SIGNUP_EMAIL_TAKEN_MESSAGE : SIGNUP_STUDENT_CODE_TAKEN_MESSAGE,
        );
      }
      throw error;
    }
    return this.issueTokenPair(user);
  }

  // Same answer whatever happens; mails only for a live request within its limits.
  async resendEmailSignup(rawEmail: string): Promise<{ message: string }> {
    const email = normalizeEmail(rawEmail);
    if (this.isSignupDomain(email)) {
      const token = await this.emailSignupRequestService.resend(email);
      if (token) this.mailSignupLink(email, token);
    }
    return { message: SIGNUP_CHECK_EMAIL_MESSAGE };
  }

  private mailSignupLink(email: string, token: string) {
    // Not awaited (timing side channel, see forgotPassword); the .catch must
    // stay so a failed send can't crash Node. EmailService logs a masked address.
    void this.emailService
      .sendSignupVerificationEmail(email, token, SIGNUP_LINK_TTL_MINUTES)
      .catch(() => undefined);
  }

  private signupDomains(): string[] {
    return this.configService.get<string[]>('signup.allowedDomains') ?? ['ku.th'];
  }

  private isSignupDomain(email: string): boolean {
    return isAllowedSignupEmail(email, this.signupDomains());
  }

  private assertSignupDomain(email: string) {
    if (!this.isSignupDomain(email)) {
      const list = this.signupDomains()
        .map((d) => `@${d}`)
        .join(' หรือ ');
      throw new BadRequestException(`สมัครด้วยตนเองได้เฉพาะอีเมล ${list}`);
    }
  }

  private async emailHasAccount(email: string): Promise<boolean> {
    try {
      await this.userService.findByEmail(email);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException) return false;
      throw error;
    }
  }

  async handleGoogleCallback(profile: GoogleProfile) {
    // Every Google sign-in, new or returning: Google must vouch for the address.
    if (!profile.emailVerified) {
      throw new GoogleSignupRefusedException('email_unverified');
    }
    const existingMethod =
      await this.userAuthMethodService.findByProviderAndProviderUserId(
        AuthProvider.GOOGLE,
        profile.googleId,
      );

    if (existingMethod) {
      const user = await this.userService.findById(existingMethod.userId);
      // Google verifying identity is not a substitute for TOTP step-up —
      // a user who opted into 2FA must clear it regardless of which
      // first factor they used (advisor feedback: step up Google login
      // too, not just email+password).
      if (await this.twoFactorService.isEnabled(user.id)) {
        return {
          pendingToken: this.signPendingTwoFactorToken(user.id),
          requiresTwoFactor: true as const,
        };
      }
      return this.issueTokenPair(user);
    }

    // No Google identity linked yet — check if an account already exists
    // under this email via a different method. If so, refuse: linking is
    // out of scope for this phase, and silently merging accounts here
    // would be an account-takeover vector.
    let existingUser: User | null = null;
    try {
      existingUser = await this.userService.findByEmail(profile.email);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }
    if (existingUser) {
      throw new ConflictException(
        'An account already exists with this email using a different sign-in method',
      );
    }

    // Brand-new identity = a self-service sign-up, so the domain rule applies
    // (read from Google's claim, never from the client). Returning users above
    // are not re-checked: the rule governs who may join, not who may stay.
    const email = normalizeEmail(profile.email);
    if (!this.isSignupDomain(email) || !this.hostedDomainOk(profile, email)) {
      throw new GoogleSignupRefusedException('domain_not_allowed');
    }

    // Cannot create the User yet (no studentCode/program/curriculum/
    // admissionYear from Google) — park it as a pending registration and let
    // the client collect the rest.
    const pendingToken = await this.googlePendingRegistrationService.create(
      email,
      profile.googleId,
      profile.fullName,
    );
    return { pendingToken, isNewUser: true };
  }

  async completeGoogleRegistration(dto: CompleteGoogleRegistrationDto) {
    assertCurrentPrivacyPolicyVersion(dto.privacyPolicyVersion);
    const pending = await this.googlePendingRegistrationService.findValidByToken(
      dto.pendingToken,
    );
    // Again at completion, from the server-side pending row: the allowed
    // domains may have changed in the 10 minutes since the callback.
    this.assertSignupDomain(pending.email);

    const user = await this.createStudentAccount(
      {
        email: pending.email,
        passwordHash: null,
        fullName: pending.fullName,
        provider: AuthProvider.GOOGLE,
        providerUserId: pending.googleId,
        studentCode: dto.studentCode,
        programId: dto.programId,
        curriculumId: dto.curriculumId,
        admissionYear: dto.admissionYear,
        privacyPolicyVersion: dto.privacyPolicyVersion,
      },
      (tx) => tx.googlePendingRegistration.delete({ where: { id: pending.id } }),
    );

    // Google already verified this identity — issue tokens immediately,
    // same as register()/login().
    return this.issueTokenPair(user);
  }

  // With GOOGLE_REQUIRE_HOSTED_DOMAIN=true the account must also be managed by
  // that organisation's Google Workspace (`hd` claim equals the email domain),
  // so an address the university has since closed can't sign up.
  private hostedDomainOk(profile: GoogleProfile, email: string): boolean {
    if (!this.configService.get<boolean>('google.requireHostedDomain')) return true;
    const hd = profile.hostedDomain?.trim().toLowerCase();
    return !!hd && email.endsWith(`@${hd}`) && this.signupDomains().includes(hd);
  }

  // Shared by register() (PASSWORD) and completeGoogleRegistration()
  // (GOOGLE) — the one place that creates User+UserAuthMethod+UserRole+
  // StudentProfile atomically, per the "single transaction" rule. Accepts
  // an optional extra step run inside the same transaction (used to
  // consume/delete the pending-registration row exactly once).
  private async createStudentAccount(
    params: CreateStudentAccountParams,
    extraTxStep?: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const createdUser = await this.userService.create(
        params.email,
        params.passwordHash,
        params.fullName,
        tx,
      );

      await this.userAuthMethodService.create(
        createdUser.id,
        params.provider,
        params.providerUserId,
        tx,
      );

      // Role is always STUDENT on self-registration — the client can never
      // choose its own role. Any other role is assigned separately by an
      // admin flow (Phase 13/14), not here.
      await this.userRoleService.assignRole(createdUser.id, Role.STUDENT, tx);

      await this.studentProfileService.create(
        createdUser.id,
        params.studentCode,
        params.programId,
        params.curriculumId,
        params.admissionYear,
        tx,
      );

      // Same transaction as the account: no student account exists without
      // a record of the policy version it accepted.
      await tx.userConsent.create({
        data: {
          userId: createdUser.id,
          kind: ConsentKind.PRIVACY_POLICY,
          policyVersion: params.privacyPolicyVersion,
        },
      });

      if (extraTxStep) {
        await extraTxStep(tx);
      }

      return createdUser;
    });
  }

  async login(dto: LoginDto) {
    // Same generic message for "no such email" and "wrong password" —
    // a distinct 404-style message here would let a client enumerate
    // which emails are registered.
    let user: User;
    try {
      user = await this.userService.findByEmail(dto.email);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }
      throw error;
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    // Locked: same generic 401 as a wrong password and no bcrypt compare, so
    // neither the response nor the timing reveals the lock (or the account).
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    // Password alone is enough UNLESS this user opted into 2FA — checked
    // live from the database every login (same "always resolve live"
    // principle as mustChangePassword), so this is the one and only
    // branch point: everyone who never enables 2FA gets byte-identical
    // behavior to before this feature existed.
    // The lockout counter is NOT cleared here for a 2FA account: only a
    // correct code clears it (verifyTwoFactorLogin), otherwise someone who
    // knows the password could reset the code-guess budget by logging in again.
    if (await this.twoFactorService.isEnabled(user.id)) {
      return {
        pendingToken: this.signPendingTwoFactorToken(user.id),
        requiresTwoFactor: true as const,
      };
    }

    await this.clearLockout(user);
    return this.issueTokenPair(user);
  }

  // POST /auth/2fa/verify. Shares the login lockout counter (same threshold,
  // backoff and cap), and answers a locked account with the same 401 as a
  // wrong code without checking it — so a recovery code is never spent on a
  // locked account and the response does not reveal the lock.
  async verifyTwoFactorLogin(userId: string, code: string) {
    const user = await this.userService.findById(userId);
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException(INVALID_TWO_FACTOR_CODE_MESSAGE);
    }
    if (!(await this.twoFactorService.verifyLoginCode(user.id, code))) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException(INVALID_TWO_FACTOR_CODE_MESSAGE);
    }
    await this.clearLockout(user);
    return this.issueTokenPair(user);
  }

  private async clearLockout(user: User) {
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
  }

  // Exponential backoff per account: from the 5th consecutive failure (wrong
  // password or wrong 2FA code) the account is locked 1, 2, 4, … minutes,
  // capped at 15.
  private async recordFailedLogin(user: User) {
    const attempts = user.failedLoginAttempts + 1;
    const lockMinutes =
      attempts >= LOCKOUT_THRESHOLD
        ? Math.min(2 ** (attempts - LOCKOUT_THRESHOLD), LOCKOUT_MAX_MINUTES)
        : 0;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: lockMinutes ? new Date(Date.now() + lockMinutes * 60_000) : null,
      },
    });
  }

  async completeTwoFactorLogin(userId: string) {
    const user = await this.userService.findById(userId);
    return this.issueTokenPair(user);
  }

  // Sets the password for a User created via Module 12 (User Management)
  // — that flow creates User/UserRole/UserScope immediately with
  // passwordHash:null, gated behind this invitation token. No auto-login
  // afterward — same as every other auth entry point, the new user goes
  // through normal /auth/login next, not a shortcut.
  async acceptInvitation(dto: AcceptInvitationDto) {
    const pending = await this.pendingInvitationService.findValidByToken(
      dto.token,
    );
    const passwordHash = await hashPassword(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: pending.userId },
        data: { passwordHash, ...this.revokeAllSessionsData() },
      });
      await this.pendingInvitationService.consume(pending.id, tx);
    });
  }

  // Public, unauthenticated — backs GET /auth/invitation/:token so the
  // register page can pre-fill before the visitor has any account at all.
  // Only ever reads; findValidByToken already throws on missing/expired.
  async getInvitationPreview(token: string) {
    const invitation = await this.studentInvitationService.findValidByToken(
      token,
    );
    // The FK guarantees this row exists — no null-check branch needed,
    // unlike a client-supplied id.
    const curriculum = (await this.prisma.curriculum.findUnique({
      where: { id: invitation.curriculumId },
      select: { version: true, program: { select: { code: true } } },
    }))!;

    return {
      email: invitation.email,
      fullName: invitation.fullName,
      studentCode: invitation.studentCode,
      programCode: curriculum.program.code,
      curriculumVersion: curriculum.version,
      admissionYear: invitation.admissionYear,
    };
  }

  async getMe(userId: string) {
    const user = await this.userService.findById(userId);
    const roles = await this.userRoleService.findRolesByUserId(userId);
    const twoFactorEnabled = await this.twoFactorService.isEnabled(userId);
    return {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roles,
      mustChangePassword: user.mustChangePassword,
      twoFactorEnabled,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userService.findById(userId);

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'No password set on this account — sign in with Google, or accept your invitation first',
      );
    }

    const oldPasswordMatches = await bcrypt.compare(
      dto.oldPassword,
      user.passwordHash,
    );
    if (!oldPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        ...this.revokeAllSessionsData(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    // Every refresh token (including this device's) is now invalid; hand
    // the caller a fresh one so only *other* sessions are signed out.
    return this.issueTokenPair(updated, { recordLogin: false });
  }

  // Refresh tokens whose iat is before this instant are rejected by
  // JwtRefreshStrategy. Floored to the second because iat has second
  // resolution — a token issued right after this write still passes.
  private revokeAllSessionsData() {
    return { tokenValidAfter: new Date(Math.floor(Date.now() / 1000) * 1000) };
  }

  // Always the same response whether or not the email exists — a distinct
  // "no such account" message would let a client enumerate registered
  // emails (CONVENTIONS.md §34, same reasoning as login's generic
  // INVALID_CREDENTIALS_MESSAGE).
  async forgotPassword(dto: ForgotPasswordDto) {
    let user: User;
    try {
      user = await this.userService.findByEmail(dto.email);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { message: 'If an account exists, a reset link has been sent' };
      }
      throw error;
    }

    if (user.passwordHash) {
      const token = await this.passwordResetService.create(user.id);
      // Not awaited: waiting on the SMTP send made this response ~100x
      // slower only when the account exists — an account-enumeration side
      // channel via timing, just as letting a send failure propagate would
      // be one via response shape. The .catch must stay attached: an
      // unhandled rejection crashes Node 22 by default. EmailService.sendMail
      // already logs the failure.
      void this.emailService
        .sendPasswordSetupEmail(user.email, token, 'reset')
        .catch(() => undefined);
    }
    // A Google-only account (passwordHash: null) gets no token — there's
    // no password to reset. Same generic response either way, so this
    // doesn't leak which case applied.

    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const pending = await this.passwordResetService.findValidByToken(dto.token);
    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: pending.userId },
        // mustChangePassword: false — same as changePassword() above.
        // Without this, an admin-created account (mustChangePassword:
        // true, unusable starting hash) that sets its real password via
        // this same endpoint (the "password setup" email reuses it) would
        // still carry the flag, land back on ProtectedRoute's forced gate
        // right after login, and be made to set a password a second time.
        data: {
          passwordHash,
          mustChangePassword: false,
          ...this.revokeAllSessionsData(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.passwordResetService.consume(pending.id, tx);
    });
  }

  private async buildJwtPayload(user: User, authTime: number): Promise<JwtPayload> {
    const roles = await this.userRoleService.findRolesByUserId(user.id);
    return { sub: user.id, email: user.email, roles, authTime };
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });
  }

  // Minimal payload ({sub} only, see TwoFactorPendingPayload) and its own
  // secret+short TTL — verified by Jwt2faPendingStrategy at
  // POST /auth/2fa/verify, never by the ordinary access-token strategy.
  private signPendingTwoFactorToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwt.twoFactorPendingSecret'),
        expiresIn: this.configService.get<string>('jwt.twoFactorPendingExpiresIn'),
      },
    );
  }

  // Every sign-in (password, 2FA, Google, sign-up) ends here and stamps
  // lastLoginAt; changePassword passes recordLogin: false since it only
  // re-issues tokens for a session that already exists. A suspended account
  // still receives tokens (the JWT strategies refuse them on first use), so it
  // is not counted as a sign-in.
  private async issueTokenPair(user: User, { recordLogin = true } = {}) {
    const payload = await this.buildJwtPayload(user, Math.floor(Date.now() / 1000));

    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      // Unique id so POST /auth/logout can denylist exactly this token.
      jwtid: randomUUID(),
    });

    if (recordLogin && user.isActive) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return { accessToken, refreshToken };
  }

  // Backs POST /auth/logout — denylists the presented refresh token by jti
  // (RevokedRefreshToken) so a copied cookie stops working. `user` is null
  // when the cookie was missing/invalid/expired/already revoked: nothing to
  // revoke, and the caller still gets the same success response.
  async revokeRefreshToken(user: RequestUser | null): Promise<void> {
    if (!user?.refreshJti || !user.refreshExp) {
      return;
    }
    await this.prisma.revokedRefreshToken.upsert({
      where: { jti: user.refreshJti },
      create: { jti: user.refreshJti, expiresAt: new Date(user.refreshExp * 1000) },
      update: {},
    });
    // Rows past their token's own exp can never matter again.
    await this.prisma.revokedRefreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  // Backs POST /auth/refresh — reissues only a new access token. The
  // refresh token itself is not rotated; logout revokes it via the
  // RevokedRefreshToken denylist instead.
  //
  // Enforces the absolute session lifetime: authTime (original login) is
  // carried over unchanged, and once SESSION_ABSOLUTE_MAX_HOURS has passed
  // no new access token is minted, whatever the refresh cookie's own exp.
  async refreshAccessToken(
    userId: string,
    authTime: number = Math.floor(Date.now() / 1000),
  ): Promise<{ accessToken: string }> {
    const maxHours = this.configService.get<number>('session.absoluteMaxHours') ?? 8;
    if (Date.now() / 1000 - authTime > maxHours * 3600) {
      throw new UnauthorizedException('เซสชันมีอายุครบกำหนดสูงสุด กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    const user = await this.userService.findById(userId);
    const payload = await this.buildJwtPayload(user, authTime);
    return { accessToken: this.signAccessToken(payload) };
  }
}
