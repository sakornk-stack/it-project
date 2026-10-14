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
import { AuthProvider, Prisma, Role, User } from '@prisma/client';
import { hashPassword } from '../../common/util/password.util';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../users/user/user.service';
import { UserRoleService } from '../users/user-role/user-role.service';
import { UserAuthMethodService } from '../users/user-auth-method/user-auth-method.service';
import { StudentProfileService } from '../users/student-profile/student-profile.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
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

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

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
    private readonly pendingInvitationService: PendingInvitationService,
    private readonly studentInvitationService: StudentInvitationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly emailService: EmailService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);

    // Invited path: academic fields always come from the StudentInvitation
    // row, never from dto — a tampered client body can't smuggle a
    // different program/curriculum/studentCode through a valid token.
    // Only email is cross-checked (a token can't be replayed against a
    // different address) and only fullName is allowed to differ (the
    // student may correct a typo staff made).
    if (dto.invitationToken) {
      const invitation = await this.studentInvitationService.findValidByToken(
        dto.invitationToken,
      );
      if (invitation.email !== dto.email) {
        throw new BadRequestException(
          'Email must match the one this invitation was sent to',
        );
      }

      const user = await this.createStudentAccount(
        {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          provider: AuthProvider.PASSWORD,
          providerUserId: null,
          studentCode: invitation.studentCode,
          programId: invitation.programId,
          curriculumId: invitation.curriculumId,
          admissionYear: invitation.admissionYear,
        },
        (tx) => this.studentInvitationService.consume(invitation.id, tx),
      );
      return this.issueTokenPair(user);
    }

    // Uninvited (fully self-service) path — unchanged from before
    // invitations existed. class-validator only marks these @IsOptional
    // at the DTO level (the requirement depends on invitationToken's
    // presence, not on studentCode's own type), so it's enforced here.
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

    const user = await this.createStudentAccount({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      provider: AuthProvider.PASSWORD,
      providerUserId: null,
      studentCode: dto.studentCode,
      programId: dto.programId,
      curriculumId: dto.curriculumId,
      admissionYear: dto.admissionYear,
    });

    return this.issueTokenPair(user);
  }

  async handleGoogleCallback(profile: GoogleProfile) {
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

    // Brand-new identity: cannot create the User yet (no studentCode/
    // program/curriculum/admissionYear from Google) — park it as a
    // pending registration and let the client collect the rest.
    const pendingToken = await this.googlePendingRegistrationService.create(
      profile.email,
      profile.googleId,
      profile.fullName,
    );
    return { pendingToken, isNewUser: true };
  }

  async completeGoogleRegistration(dto: CompleteGoogleRegistrationDto) {
    const pending = await this.googlePendingRegistrationService.findValidByToken(
      dto.pendingToken,
    );

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
      },
      (tx) => tx.googlePendingRegistration.delete({ where: { id: pending.id } }),
    );

    // Google already verified this identity — issue tokens immediately,
    // same as register()/login().
    return this.issueTokenPair(user);
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

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    // Password alone is enough UNLESS this user opted into 2FA — checked
    // live from the database every login (same "always resolve live"
    // principle as mustChangePassword), so this is the one and only
    // branch point: everyone who never enables 2FA gets byte-identical
    // behavior to before this feature existed.
    if (await this.twoFactorService.isEnabled(user.id)) {
      return {
        pendingToken: this.signPendingTwoFactorToken(user.id),
        requiresTwoFactor: true as const,
      };
    }

    return this.issueTokenPair(user);
  }

  // Called by POST /auth/2fa/verify once TwoFactorService.verifyLoginCode
  // confirms the code — issues the exact same token pair a normal
  // login()/register() would, just reached via a different path.
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
        data: { passwordHash },
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
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
        data: { passwordHash, mustChangePassword: false },
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

  private async issueTokenPair(user: User) {
    const payload = await this.buildJwtPayload(user, Math.floor(Date.now() / 1000));

    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      // Unique id so POST /auth/logout can denylist exactly this token.
      jwtid: randomUUID(),
    });

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
