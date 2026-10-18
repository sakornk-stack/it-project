import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { GoogleProfile } from '../google-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      // Read directly from process.env — ConfigService isn't available
      // before super() runs, same reason JwtStrategy does this.
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  // No business logic here — just normalizes the raw Google profile.
  // AuthService.handleGoogleCallback() owns every decision about what to
  // do with it (login / reject / start pending registration).
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    // Claims only, passed through unjudged — AuthService decides.
    // `verified` comes from the userinfo `email_verified` claim (boolean, but
    // accepted as the string "true" too); `hd` only exists on Workspace accounts.
    const verified: unknown = profile.emails?.[0]?.verified;
    const json = (profile as unknown as { _json?: { hd?: unknown } })._json;
    const googleProfile: GoogleProfile = {
      email: profile.emails?.[0]?.value ?? '',
      googleId: profile.id,
      fullName: profile.displayName,
      emailVerified: verified === true || verified === 'true',
      hostedDomain: typeof json?.hd === 'string' ? json.hd : undefined,
    };
    done(null, googleProfile);
  }
}
