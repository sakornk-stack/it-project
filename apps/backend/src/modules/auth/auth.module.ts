import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../../common/email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GooglePendingRegistrationService } from './google-pending-registration.service';
import { EmailSignupRequestService } from './email-signup-request.service';
import { ExpiredSignupCleanupService } from './expired-signup-cleanup.service';
import { PendingInvitationModule } from './pending-invitation.module';
import { StudentInvitationModule } from './student-invitation.module';
import { PasswordResetModule } from './password-reset.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { Jwt2faPendingStrategy } from './strategies/jwt-2fa-pending.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { TwoFactorService } from './two-factor.service';

@Module({
  // No default secret/expiry on JwtModule — access and refresh tokens use
  // two different secrets, passed explicitly on each jwtService.sign()
  // call in AuthService instead of a single module-wide default.
  // JwtStrategy verifies incoming access tokens (Authorization header); it
  // reads JWT_ACCESS_SECRET directly (see strategies/jwt.strategy.ts).
  // JwtRefreshStrategy is its sibling for the refresh cookie — reads
  // JWT_REFRESH_SECRET, see strategies/jwt-refresh.strategy.ts.
  // GoogleStrategy reads GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL directly for
  // the same reason.
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
    PendingInvitationModule,
    StudentInvitationModule,
    PasswordResetModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GooglePendingRegistrationService,
    EmailSignupRequestService,
    ExpiredSignupCleanupService,
    TwoFactorService,
    JwtStrategy,
    JwtRefreshStrategy,
    Jwt2faPendingStrategy,
    GoogleStrategy,
  ],
  exports: [TwoFactorService],
})
export class AuthModule {}
