import {
  ConflictException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Body,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipPasswordChangeCheck } from '../../common/decorators/skip-password-change-check.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { OptionalJwtRefreshGuard } from '../../common/guards/jwt-refresh-optional.guard';
import { Jwt2faPendingGuard } from '../../common/guards/jwt-2fa-pending.guard';
import { AuthService } from './auth.service';
import { GoogleSignupRefusedException } from './google-signup-refused.exception';
import { TwoFactorService } from './two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CompleteGoogleRegistrationDto } from './dto/complete-google-registration.dto';
import { ResendEmailSignupDto } from './dto/resend-email-signup.dto';
import { VerifyEmailSignupDto } from './dto/verify-email-signup.dto';
import { TwoFactorEnableDto } from './dto/two-factor-enable.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { TwoFactorRegenerateRecoveryCodesDto } from './dto/two-factor-regenerate-recovery-codes.dto';
import { GoogleProfile } from './google-profile.interface';
import { RequestUser } from './request-user.interface';

const REFRESH_COOKIE_NAME = 'refreshToken';
// Keep in sync with JWT_REFRESH_EXPIRES_IN's default (7d) — the cookie's
// own expiry is just a client-side hint anyway, the JWT's own `exp` claim
// is what JwtRefreshStrategy actually enforces.
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Register a student. With invitationToken: creates the account, sets the refresh cookie and returns the access token. Without: starts an email sign-up (allowed domains only) and returns 202 with a generic message — the account is only created by POST /auth/register/verify.',
  })
  @ApiResponse({ status: 201, description: 'Invited: access token issued, refresh cookie set' })
  @ApiResponse({ status: 202, description: 'Self-service: check-your-email message (same for every address)' })
  @ApiResponse({ status: 400, description: 'Domain not allowed, or invalid/mismatched program/curriculum' })
  @ApiResponse({ status: 409, description: 'Invited: email or student code already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(dto);
    if ('message' in result) {
      response.status(HttpStatus.ACCEPTED);
      return result;
    }
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('register/verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Finish an email sign-up with the token from the verification mail — creates the STUDENT account, sets the refresh cookie and returns the access token',
  })
  @ApiResponse({ status: 201, description: 'Account created, access token issued, refresh cookie set' })
  @ApiResponse({ status: 401, description: 'Link expired, already used or invalid' })
  @ApiResponse({ status: 409, description: 'Email already has an account, or student code taken' })
  async verifyEmailSignup(
    @Body() dto: VerifyEmailSignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.verifyEmailSignup(dto.token);
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  @Post('register/resend')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Re-send the verification mail of a pending email sign-up. Always the same generic answer; per-address cooldown and daily cap apply.',
  })
  @ApiResponse({ status: 202, description: 'Generic check-your-email message' })
  async resendEmailSignup(
    @Body() dto: ResendEmailSignupDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.status(HttpStatus.ACCEPTED);
    return this.authService.resendEmailSignup(dto.email);
  }

  // Public, unauthenticated — the register page calls this before the
  // visitor has any account, to pre-fill the academic fields a
  // StudentInvitation carries. Pre-fill only; AuthService.register still
  // re-resolves the invitation itself from the token, never trusting
  // whatever the client echoes back from this response.
  @Get('invitation/:token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Preview a StudentInvitation for the register page to pre-fill',
  })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  @ApiResponse({ status: 401, description: 'Invitation expired or invalid' })
  getInvitationPreview(@Param('token') token: string) {
    return this.authService.getInvitationPreview(token);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Verify email + password. If the account has 2FA enabled, returns a short-lived pendingToken instead of an access token — submit it with a TOTP/recovery code to POST /auth/2fa/verify to finish logging in. Otherwise sets the refresh token as an httpOnly cookie and returns the access token in the body, unchanged from before 2FA existed.',
  })
  @ApiResponse({ status: 201, description: 'Access token issued (refresh cookie set), or a pendingToken if 2FA is required' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    if ('requiresTwoFactor' in result) {
      return result;
    }
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({
    summary:
      'Exchange the httpOnly refresh cookie for a new access token — the refresh token itself is not rotated',
  })
  @ApiResponse({ status: 201, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Refresh cookie missing, invalid, or expired' })
  refresh(@CurrentUser() user: RequestUser) {
    return this.authService.refreshAccessToken(user.userId, user.authTime);
  }

  @Post('accept-invitation')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Set a password for a user created via User Management (Module 12), consuming the invitation token',
  })
  @ApiResponse({ status: 201, description: 'Password set — log in normally next' })
  @ApiResponse({ status: 401, description: 'Invitation expired or invalid' })
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.authService.acceptInvitation(dto);
  }

  // Authenticates with the refresh cookie (not the 15m access token), so an
  // idle-timeout logout still revokes server-side after the access token
  // has expired. Always succeeds: with no/invalid cookie it only clears the
  // caller's own cookie and reveals nothing about why.
  @Post('logout')
  @UseGuards(OptionalJwtRefreshGuard)
  @ApiOperation({
    summary:
      'Logout — revokes the refresh token from the httpOnly cookie server-side and clears the cookie. Always succeeds.',
  })
  @ApiResponse({ status: 201, description: 'Refresh token revoked (if valid), cookie cleared' })
  async logout(
    @CurrentUser() user: RequestUser | null,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.revokeRefreshToken(user);
    this.clearRefreshCookie(response);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.authService.getMe(user.userId);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change the current user’s password' })
  @ApiResponse({ status: 200, description: 'Password changed — all other sessions are signed out' })
  @ApiResponse({ status: 401, description: 'Current password incorrect, or no password set on this account' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken } = await this.authService.changePassword(user.userId, dto);
    this.setRefreshCookie(response, refreshToken);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Request a password reset link — always returns the same response whether or not the email exists (prevents account enumeration)',
  })
  @ApiResponse({ status: 201, description: 'If an account exists, a reset link has been sent' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Set a new password using a forgot-password reset token' })
  @ApiResponse({ status: 201, description: 'Password reset — log in normally next' })
  @ApiResponse({ status: 401, description: 'Reset link expired or invalid' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Generate a new TOTP secret + QR code (not yet active) — call POST /auth/2fa/enable with a code from the scanned app to actually turn 2FA on. Safe to call repeatedly while 2FA is not yet enabled (each call overwrites the previous unconfirmed secret); 409 once enabled — disable it first.',
  })
  @ApiResponse({ status: 201, description: 'QR code (data URL) + secret for manual entry' })
  twoFactorSetup(@CurrentUser() user: RequestUser) {
    return this.twoFactorService.setup(user.userId, user.email);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Confirm a 6-digit code from the authenticator app to actually turn 2FA on — proves the app was set up correctly before it can lock the account. Returns 8 recovery codes, shown exactly once.',
  })
  @ApiResponse({ status: 201, description: '2FA enabled; recovery codes (plaintext, one-time)' })
  @ApiResponse({ status: 400, description: 'No pending setup — call POST /auth/2fa/setup first' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  twoFactorEnable(@Body() dto: TwoFactorEnableDto, @CurrentUser() user: RequestUser) {
    return this.twoFactorService.enable(user.userId, dto.code);
  }

  @Post('2fa/regenerate-recovery-codes')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Replace all recovery codes with a fresh set of 8 — the old set stops working immediately (useful if you suspect they leaked, or just used your last one). Requires a live TOTP code, not the password.',
  })
  @ApiResponse({ status: 201, description: 'New recovery codes (plaintext, one-time)' })
  @ApiResponse({ status: 400, description: '2FA is not enabled on this account' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  twoFactorRegenerateRecoveryCodes(
    @Body() dto: TwoFactorRegenerateRecoveryCodesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.twoFactorService.regenerateRecoveryCodes(user.userId, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @SkipPasswordChangeCheck()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Turn 2FA off — requires the current password to confirm' })
  @ApiResponse({ status: 201, description: '2FA disabled' })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  async twoFactorDisable(@Body() dto: TwoFactorDisableDto, @CurrentUser() user: RequestUser) {
    await this.twoFactorService.disable(user.userId, dto.password);
    return { message: '2FA disabled' };
  }

  @Post('2fa/verify')
  @UseGuards(Jwt2faPendingGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Second step of login for an account with 2FA enabled — submit the pendingToken from POST /auth/login (as the Authorization bearer) plus a TOTP or recovery code. Issues the same access token + refresh cookie a normal login would.',
  })
  @ApiResponse({ status: 201, description: 'Access token issued, refresh cookie set' })
  @ApiResponse({ status: 401, description: 'pendingToken expired/invalid, or the code is wrong' })
  async twoFactorVerify(
    @Body() dto: TwoFactorVerifyDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.verifyTwoFactorLogin(
      user.userId,
      dto.code,
    );
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Start Google OAuth sign-in (redirects to Google)' })
  googleAuth() {
    // Body intentionally empty — AuthGuard('google') intercepts the
    // request and performs the redirect to Google's consent screen.
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary:
      'Google OAuth callback — a top-level browser redirect target, not a fetch call, so it can\'t return JSON. Sets the refresh cookie (returning user) then redirects into the frontend.',
  })
  async googleAuthCallback(
    @CurrentUser() profile: GoogleProfile,
    @Res({ passthrough: true }) response: Response,
  ) {
    const frontendUrl = this.configService.get<string>('frontendUrl');
    let result: Awaited<ReturnType<AuthService['handleGoogleCallback']>>;
    try {
      result = await this.authService.handleGoogleCallback(profile);
    } catch (error) {
      // Top-level browser redirect: a thrown 409 would render as raw JSON,
      // so send the user back to /login with a code the page turns into a
      // friendly message.
      if (error instanceof ConflictException) {
        response.redirect(`${frontendUrl}/login?googleError=email_exists`);
        return;
      }
      // Unverified address, or not an allowed domain for a new sign-up.
      if (error instanceof GoogleSignupRefusedException) {
        response.redirect(`${frontendUrl}/login?googleError=${error.reason}`);
        return;
      }
      throw error;
    }

    if ('isNewUser' in result) {
      response.redirect(
        `${frontendUrl}/register/google?pendingToken=${encodeURIComponent(result.pendingToken)}`,
      );
      return;
    }

    if ('requiresTwoFactor' in result) {
      // Top-level redirect target (see this route's own doc comment) —
      // can't return JSON, so the pending token travels as a query
      // param. The login page reads it on mount and jumps straight to
      // the code-entry step instead of the email/password form.
      response.redirect(
        `${frontendUrl}/login?pendingToken=${encodeURIComponent(result.pendingToken)}&requires2fa=1`,
      );
      return;
    }

    this.setRefreshCookie(response, result.refreshToken);
    // /login (not the / hub) signs the refresh cookie in and forwards to the
    // role's dashboard, or to the page the user started from.
    response.redirect(`${frontendUrl}/login`);
  }

  @Post('google/complete-registration')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Finish Google sign-up by supplying the remaining student fields — sets the refresh token as an httpOnly cookie and returns the access token in the body',
  })
  @ApiResponse({ status: 201, description: 'Access token issued, refresh cookie set' })
  @ApiResponse({ status: 401, description: 'Pending registration session expired or invalid' })
  @ApiResponse({ status: 400, description: 'Invalid or mismatched program/curriculum' })
  @ApiResponse({ status: 409, description: 'Student code already in use' })
  async completeGoogleRegistration(
    @Body() dto: CompleteGoogleRegistrationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.completeGoogleRegistration(dto);
    this.setRefreshCookie(response, refreshToken);
    return { accessToken };
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: this.configService.get<string>('nodeEnv') === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
  }
}
